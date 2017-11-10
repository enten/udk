const {DepGraph} = require('dependency-graph')
const MultiCompiler = require('webpack/lib/MultiCompiler')
const Stats = require('webpack/lib/Stats')
const getDebugger = require('./util/debug')

const STAGE = {
  'environment': 1,
  'after-environment': 2,
  'entry-option': 3,
  'after-plugins': 4,
  'after-resolvers': 5,
  'before-run': 6,
  'run': 7,
  'watch-run': 8,
  'normal-module-factory': 9,
  'context-module-factory': 10,
  'before-compile': 11,
  'compile': 12,
  'this-compilation': 13,
  'compilation': 14,
  'make': 15,
  'after-compile': 16,
  'should-emit': 17,
  'need-additional-pass': 18,
  'emit': 19,
  'after-emit': 20,
  'done': 21,
  'failed': 22,
  'invalid': 0,
  'watch-close': -1
}

const STAGES_ASYNC = [
  'before-run',
  'run',
  'watch-run',
  'before-compile',
  'make',
  'after-compile',
  'emit',
  'after-emit'
]

class MultiCompiler2 extends MultiCompiler {
  constructor (compilers) {
    if (!compilers || (!Array.isArray(compilers) && typeof compilers !== 'object')) {
      throw new Error('MultiCompiler2 accepts array of compilers only')
    }

    if (!Array.isArray(compilers)) {
      compilers = Object.keys(compilers).map((key) => {
        compilers[key].name = key // side effect

        return compilers[key]
      })
    }

    if (!compilers.length) {
      throw new Error('No compilers was given (array of compilers is empty)')
    }

    const namesDistinct = compilers.filter((c, index, arr) => {
      if (!c.name) {
        throw new Error(`Each compiler must have a name defined: compiler #${index} has none`)
      }

      return arr.find(({name}) => name === c.name) === c
    })

    if (namesDistinct.length !== compilers.length) {
      throw new Error(`Each config must have a unique name: ${compilers.map((c) => c.name).join(', ')}`)
    }

    const depGraph = getDepGraph(compilers)
    const overallOrder = depGraph.overallOrder()

    compilers = overallOrder.map((compilerName) => {
      const c = depGraph.getNodeData(compilerName)
      const debug = getCompilerDebugger(c)
      const run = c.run.bind(c)

      const callbacks = []
      const watchings = []

      const {
        dependants,
        dependencies
      } = getNodeRelations(depGraph, c.name)

      c._udk = { // side effect
        callbacks,
        dependants,
        dependencies,
        lastChange: {},
        lastCompilation: undefined,
        lastError: undefined,
        lastStats: undefined,
        running: false,
        watchings
      }

      pluginManyStages(c, Object.keys(STAGE).slice(2), (stage, stageParam, cb) => { // out of scope
        debug(stage.level, stage.name)

        stage.async && cb()
      }, {prepend: true})

      c.run = (callback) => {
        const cancelledStats = getCancelledStats(c)

        if (cancelledStats) {
          debug('cancel compilation %o', c.name)

          c._udk.lastStats = cancelledStats // side effect

          callback(null, cancelledStats)

          return
        }

        run(callback)
      }
      c.plugin('watch-run', (watching, done) => {
        watchings.indexOf(watching) === -1 && watchings.push(watching)

        c._udk.running = true // side effect

        holdOnDependencies(c, () => process.nextTick(() => {
          const cancelledStats = getCancelledStats(c)

          if (cancelledStats) {
            debug('cancel compilation %o', c.name)

            return process.nextTick(() => {
              watchings.forEach((watching) => {
                !watching.closed && watching._done(null, cancelledStats.compilation)
             })
            })
          }

          done()
        }))
      })

      c.plugin('this-compilation', (compilation) => {
        c._udk.lastCompilation = compilation // side effect
      })

      c.plugin('done', (stats) => {
        c._udk.lastError = null // side effect
        c._udk.lastStats = stats // side effect
        c._udk.running = false // side effect

        for (; callbacks.length; ((cb) => cb(null, stats))(callbacks.shift())); // side effect

        invalidateDependants(c)
      })

      c.plugin('failed', (err) => {
        c._udk.lastError = err // side effect
        c._udk.lastStats = null // side effect
        c._udk.running = false // side effect

        for (; callbacks.length; ((cb) => cb(err))(callbacks.shift())); // side effect

        invalidateDependants(c)
      })

      c.plugin('invalid', (fileName, changeTime) => {
        c._udk.lastChange = {fileName, changeTime} // side effect
      })

      return c
    })

    super(compilers)

    this._udk = {
      depGraph,
      overallOrder
    }
  }

  getCompiler (name) {
    return this._udk.depGraph.getNodeData(name)
  }
}

function getCancelledCompilation (compiler) {
  const {
    dependencies,
    lastCompilation
  } = compiler._udk


  const compilesBadly = dependencies.filter((d) => {
    return d._udk.lastStats ? d._udk.lastStats.hasErrors() : d._udk.lastError
  })

  if (compilesBadly.length) {
    const previousCompilers = compilesBadly.map((c) => c.name).join(', ')

    const {
      fileDependencies = [],
      contextDependencies = [],
      missingDependencies = []
    } = lastCompilation || {}

    const compilation = compiler.createCompilation()
    compilation.name = compiler.name
    compilation.errors.push(new Error(`[udk] compilation cancelled due to errors in previous compilers: ${previousCompilers}`))
    compilation.fileDependencies = fileDependencies
    compilation.contextDependencies = contextDependencies
    compilation.missingDependencies = missingDependencies
    compilation.createHash()

    return compilation
  }
}

function getCancelledStats (compiler, options = {}) {
  const cancelledCompilation = getCancelledCompilation(compiler)

  if (cancelledCompilation) {
    const cancelledStats = new Stats(cancelledCompilation)
    cancelledStats.startTime = options.startTime || Date.now()
    cancelledStats.endTime = options.endTime || cancelledStats.startTime

    return cancelledStats
  }
}

function getCompilerDebugger (compiler) {
  if (typeof compiler === 'string') {
    compiler = {name: compiler}
  }

  return getDebugger('udk', compiler.name, 'cpl')
}

function getDepGraph (nodes) {
  const graph = new DepGraph()

  nodes.forEach((node) => graph.addNode(node.name, node))

  nodes.forEach((node) => {
    node.dependencies && node.dependencies.forEach((dep) => {
      graph.addDependency(node.name, dep)
    })
  })

  return graph
}

function getNodeRelations (depGraph, nodeName) {
  const overallOrder = depGraph.overallOrder()

  const mapping = (name) => depGraph.getNodeData(name)
  const sorting = (a, b) => overallOrder.indexOf(a) > overallOrder.indexOf(b)

  return {
    dependants: depGraph.dependantsOf(nodeName).sort(sorting).map(mapping),
    dependencies: depGraph.dependenciesOf(nodeName).sort(sorting).map(mapping)
  }
}

function holdOnDependencies (compiler, callback) {
  const debug = getCompilerDebugger(compiler)
  const {dependencies} = compiler._udk

  const depsRunning = compiler._udk.dependencies.filter((d) => d._udk.running)

  depsRunning.forEach((d, index) => {
    debug('wait for compiler %o', d.name)

    d._udk.callbacks.push(() => { // side effect
      debug('waiting ended for compiler %o', d.name)

      depsRunning.splice(index, 1)
      !depsRunning.length && callback()
    })
  })

  !depsRunning.length && callback()
}

function invalidateDependants (compiler) {
  const debug = getCompilerDebugger(compiler)

  const {
    dependants,
    lastChange
  } = compiler._udk

  const depsNotRunning = dependants.filter((d) => !d._udk.running)

  depsNotRunning.forEach((d) => {
    if (d._udk.watchings.length) {
      debug('invalid compiler %o due to change %o', d.name, lastChange)

      d.applyPlugins('invalid', lastChange.fileName, lastChange.changeTime)

      d._udk.watchings.forEach((watching) => !watching.closed && watching.invalidate())
    }
  })
}

function pluginManyStages (compiler, stages, fn, options) {
  if (typeof stages === 'string') {
    stages = [stages]
  }

  stages.forEach((stageName) => {
    const stage = {
      async: STAGES_ASYNC.indexOf(stageName) > -1, // out of scope
      level: STAGE[stageName], // out of scope
      name: stageName
    }

    pluginStage(compiler, stageName, (stageParams, cb) => {
      fn(stage, stageParams, cb)
    }, options)
  })
}

function pluginStage (compiler, stageName, fn, options = {}) {
  if (!STAGE.hasOwnProperty(stageName)) { // out of scope
    throw new Error(`Stage "${stageName}" is unknown`)
  }

  if (!compiler._plugins[stageName]) {
    compiler._plugins[stageName] = []
  }

  const stagePlugins = compiler._plugins[stageName]
  const plug = stagePlugins[options.prepend ? 'unshift' : 'push'].bind(stagePlugins)

  plug(fn) // side effect
}

module.exports = MultiCompiler2
