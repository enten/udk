const Compiler = require('webpack/lib/Compiler')
const Stats = require('webpack/lib/Stats')
const debug = require('./util/debug')
const runSeries = require('./util/runSeries')

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

class Watching2 extends Compiler.Watching {
  constructor (compiler, watchOptions, handler) {
    const originalHandler = handler

    handler = (err, stats) => {
      if (compiler._udk && stats) {
        compiler._udk.lastStats = stats
      }

      originalHandler(err, stats)
    }

    super(compiler, watchOptions, handler)
  }

  _go () {
    const cancelledCompilation = getCancelledCompilation(this.compiler)

    if (cancelledCompilation) {
      const lastStats = new Stats(cancelledCompilation)
      lastStats.startTime = Date.now()

      this.running = false
      this.compiler._udk.lastStats = lastStats

      this.handler(null, lastStats)

      this.callbacks.forEach(cb => cb())
      this.callbacks.length = 0

      return
    }

    super._go()
  }

  _done (err, compilation) {
    super._done(err, compilation)

    if (this.compiler._udk) {
      const {
        dependants,
        lastStats
      } = this.compiler._udk

      if (lastStats) {
        runSeries(dependants, (compiler, callback) => {
          const {
            lastStats: depLastStats,
            watching: depWatching
          } = compiler._udk

          const depNeedNewBuild = !!depLastStats && depLastStats.startTime < lastStats.startTime

          if (depWatching && depNeedNewBuild) {
            depWatching.running = false
            return depWatching.invalidate(() => {
              callback()
            })
          }

          callback()
        })
      }
    }
  }

  invalidate(callback) {
    if (this.compiler._udk) {
      const {dependants} = this.compiler._udk

      dependants.forEach((compiler) => {
        const {watching} = compiler._udk

        if (watching && watching.watcher) {
          if (watching.watcher) {
            watching.watcher.pause()
          }
          if (watching.pausedWatcher) {
            watching.pausedWatcher.pause()
          }
        }
      })
    }

    super.invalidate(callback)
  }
}

class Compiler2 extends Compiler {
  constructor () {
    super()

    pluginStages(Object.keys(STAGE).slice(2), (stage, stageParam, cb) => {
      debug('udk', this.name, 'cpl')(stage.level, stage.name)

      stage.async && cb()
    }, this)
  }

  run (callback) {
    const cancelledCompilation = getCancelledCompilation(this)

    if (cancelledCompilation) {
      this._udk.lastStats = new Stats(cancelledCompilation)
      this._udk.lastStats.startTime = Date.now()

      return callback(null, this._udk.lastStats)
    }

    super.run((err, stats) => {
      if (this._udk && stats) {
        this._udk.lastStats = stats
      }

      callback(err, stats)
    })
  }

  watch(watchOptions, handler) {
    this.fileTimestamps = {}
    this.contextTimestamps = {}

    if (this._udk && this._udk.watching) {
      this._udk.watching.close()
    }

    const watching = new Watching2(this, watchOptions, handler)

    if (this._udk) {
      this._udk.watching = watching
    }

    return watching
  }
}

function getCancelledCompilation (compiler) {
  if (!compiler._udk) {
    return
  }

  const deps = compiler._udk.dependencies
  const compilesBadly = deps.filter((dep) => dep._udk.lastStats && dep._udk.lastStats.hasErrors())

  if (compilesBadly.length) {
    const previousCompilers = compilesBadly.map((c) => c.name).join(', ')

    const compilation = compiler.createCompilation()
    compilation.name = compiler.name
    compilation.errors.push(new Error(`[udk] compilation cancelled due to errors in previous compilers: ${previousCompilers}`))

    return compilation
  }
}

function pluginStages (stages, fn, compiler) {
  stages.forEach((stageName) => {
    if (!STAGE.hasOwnProperty(stageName)) { // out of scope
      throw new Error(`Stage "${stageName}" is unknown`)
    }

    const stage = {
      level: STAGE[stageName], // out of scope
      name: stageName,
      async: STAGES_ASYNC.indexOf(stageName) > -1 // out of scope
    }

    compiler.plugin(stageName, (stageParam, cb) => {
      fn(stage, stageParam, cb)
    })
  })
}

Compiler2.Watching = Watching2
module.exports = Compiler2
