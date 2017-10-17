const OptionsDefaulter = require('webpack/lib/OptionsDefaulter')
const WatchpackFork = require('./util/WatchpackFork')
const {fork} = require('child_process')
const {isAbsolute, resolve} = require('path')
const moduleExists = require('./util/moduleExists')

const CONTAINER_PROCESS_TITLE = 'udk-ctnr'
const DEV_CONTAINER_METAFILES = [
  'udk.container',
  'udkfile',
  'udk.config',
]
const EXIT_SIGNALS = {
  'exit': undefined,
  'SIGINT': 130,
  'SIGTERM': 143
}
const WEBPACK_METAFILES = [
  'webpack.config',
  'webpackfile'
]

const findForClient = findForTarget.bind(null, ['web', undefined])
const findForServer = findForTarget.bind(null, 'node')

class UdkDevContainer {
  static create () {
    return createDevContainer.apply(null, arguments)
  }

  constructor (uconfigPath) {
    this.uconfigPath = uconfigPath
  }

  close (callback) {
    this.watcher.close(() => {
      this.watcher = undefined

      callback && callback()
    })

    return this
  }

  getOptions (uconfig) {
    return parseOptions(uconfig.options)
  }

  getUconfig () {
    return requireES6Module(this.uconfigPath)
  }

  getWatchpackOptions (options) {
    const {uconfigPath} = this
    
    return Object.assign({}, options.watch, {
      files: []
        .concat(uconfigPath, options.metafiles, options.webpackConfig)
        .filter((filePath, index, arr) => arr.indexOf(filePath) === index),
      fork: {
        modulePath: __filename,
        args: process.argv.slice(2).concat(uconfigPath)
      },
      restartAfterAggregation: false
    })
  }

  run (callback) {
    if (this.watcher) {
      return this.close(() => this.run(callback))
    }

    const uconfig = this.getUconfig()
    const options = this.getOptions(uconfig)
    const watchpackOptions = this.getWatchpackOptions(options)

    const logger = uconfig.logger || console
    const {
      onRestart = () => logger.info('> RESTART'),
      setupWatcher = (watcher) => {
        watcher.on('aggregated', () => {
          logger.info('> file changes aggregated')
        })
      }
    } = uconfig

    this.watcher = new WatchpackFork(watchpackOptions)
    this.watcher.on('aggregated', () => {
      onRestart && onRestart()

      this.run()
    })

    setupWatcher && setupWatcher(this.watcher)

    this.watcher.watch(callback)

    return this
  }
}

function bindExitHandler (handler, options = {}) {
  if (typeof options === 'string') {
    options = [options]
  }

  if (Array.isArray(options)) {
    options = {events: options}
  }

  options = Object.assign({
    events: EXIT_SIGNALS
  }, options)

  let called

  Object.keys(options.events).forEach((event) => {
    process.on(event, (...args) => {
      if (!called) {
        let code = options.events[event]

        if (event === 'exit') {
          code = args[0]
        }

        if (code == null) {
          code = -1
        }

        called = true
        handler(event, ...args)
        process.exit(code)
      }
    })
  })
}

function configureOptionsDefaulter (defaulter) {
  if (!defaulter) {
    defaulter = new OptionsDefaulter()
  }

  defaulter.set('context', 'call', parseOptionContext)
  defaulter.set('metafiles', 'call', parseOptionMetafiles)
  defaulter.set('process', 'call', parseOptionProcess)
  defaulter.set('serverAutoRestart', false)
  defaulter.set('serverEntry', undefined)
  defaulter.set('stats', 'call', parseOptionStats)
  defaulter.set('watch', 'call', parseOptionWatch)
  defaulter.set('webpackConfig', 'call', parseOptionWebpackConfig)

  return defaulter
}

function createDevContainer () {
  const uconfigPath = resolveDevContainerConfigPath.apply(null, arguments)

  return new UdkDevContainer(uconfigPath)
}

function decorateRequestHandler (server, getRequestDecorator) {
  const serverEvents = server && server._events
  const requestHandler = serverEvents && serverEvents.request

  if (requestHandler && getRequestDecorator) {
    server._events.request = getRequestDecorator(requestHandler)
  }
}

function findForTarget (target, arr) {
  if (arr && Array.isArray(arr.stats)) {
    arr = arr.stats
  }

  if (arr && Array.isArray(arr.compilers)) {
    arr = arr.compilers
  }

  if (Array.isArray(arr)) {
    return arr.find((value) => {
      const valueFound = value
      let isFound = false

      if (value && value.compilation) {
        value = value.compilation
      }

      if (value && value.options) {
        value = value.options
      }

      if (value) {
        if (Array.isArray(target) && ~target.indexOf(value.target)) {
          isFound = true
        } else if (value.target === target) {
          isFound = true
        }
      }

      return isFound
    })
  }
}

function getOutputPathByChunkName (stats, options) {
  if (stats) {
    if (typeof options === 'string') {
      options = {chunkName: options}
    }

    const compilation = stats.compilation
    const statsJson = stats.toJson()

    options = Object.assign({chunkName: 'main'}, options)

    const {assetsByChunkName} = statsJson
    let entryChunk = assetsByChunkName[options.chunkName]

    if (entryChunk) {
      if (Array.isArray(entryChunk)) {
        entryChunk = entryChunk.find((asset) => /\.js$/.test(asset))
      }

      return resolve(compilation.compiler.outputPath, entryChunk)
    }
  }
}

function getStatsByCompiler (compiler, stats) {
  if (typeof compiler === 'string') {
    compiler = {name: compiler}
  }

  if (compiler && stats) {
    if (stats.stats) {
      stats = stats.stats
    }

    return stats.reduce((acc, value) => {
      if (!acc && value.compilation.name === compiler.name) {
        acc = value
      }

      return acc
    }, undefined)
  }
}

function parseOptionContext (value, options) {
  if (!value) {
    value = process.cwd()
  }

  if (!isAbsolute(value)) {
    value = resolve(value)
  }

  return value
}

function parseOptionMetafiles (value, options) {
  return [].concat(value || []).map((filePath) => {
    if (!isAbsolute(filePath)) {
      filePath = resolve(options.context, filePath)
    }

    return filePath
  })
}

function parseOptionProcess (value, options) {
  if (typeof value === 'string' && !isAbsolute(value)) {
    value = resolve(options.context, value)
  }

  return value
}

function parseOptionStats (value) {
  return Object.assign({
    colors: true,
    source: false
  }, value)
}

function parseOptionWatch (value) {
  return Object.assign({}, value)
}

function parseOptionWebpackConfig (value, options) {
  if (!value) {
    value = WEBPACK_METAFILES.reduce((acc, configName) => {
      const configPath = resolve(options.context, configName)

      if (!acc && moduleExists(configPath)) {
        acc = configPath
      }

      return acc
    }, undefined)
  }

  if (typeof value === 'string' && !isAbsolute(value)) {
    value = resolve(options.context, value)
  }

  if (Array.isArray(value)) {
    value = value.map((webpackConfig) => {
      if (typeof webpackConfig === 'string' && !isAbsolute(webpackConfig)) {
        webpackConfig = resolve(options.context, webpackConfig)
      }

      return webpackConfig
    })
  }

  if (typeof value === 'string') {
    value = require.resolve(value)
  }

  if (Array.isArray(value)) {
    value = value.map((webpackConfig) => {
      return require.resolve(webpackConfig)
    })
  }

  return value
}

function parseOptions (options = {}) {
  if (typeof options === 'string' && typeof arguments[1] === 'string' || Array.isArray(arguments[1])) {
    const context = options
    options = arguments[1]
    arguments[1] = Object.assign({}, arguments[2], {context})
    arguments[2] = undefined
  }

  if (typeof options === 'string' || Array.isArray(options)) {
    options = Object.assign({}, arguments[1], {webpackConfig: options})
    arguments[1] = arguments[2]
    arguments[2] = undefined
  }

  if (arguments[1]) {
    options = Object.assign({}, options, arguments[1])
  }

  configureOptionsDefaulter().process(options)

  return options
}

function requireES6Module (modulePath, cache) {
  if (!cache && require.cache[modulePath]) {
    delete require.cache[modulePath]
  }

  const mod = require(modulePath)

  return mod && mod.default || mod
}

function resolveDevContainerConfigPath (uconfigPath) {
  if (!uconfigPath) {
    uconfigPath = DEV_CONTAINER_METAFILES.reduce((acc, configName) => {
      const configPath = resolve(configName)

      if (!acc && moduleExists(configPath)) {
        acc = configPath
      }

      return acc
    }, undefined)
  }

  if (arguments.length > 1) {
    uconfigPath = resolve.apply(null, arguments)
  }

  if (typeof uconfigPath === 'string' && !isAbsolute(uconfigPath)) {
    uconfigPath = resolve(uconfigPath)
  }

  uconfigPath = require.resolve(uconfigPath)

  return uconfigPath
}

if (require.main === module && process.send) {
  process.title = CONTAINER_PROCESS_TITLE

  const udk = require('./udk')
  const modulePath = process.argv.pop()

  const uconfig = require(modulePath)
  const options = parseOptions(uconfig.options)

  const logger = uconfig.logger || console
  const {
    onServerError = logger.error,
    requestDecorator = (requestHandler) => {
      return (req, res) => {
        if (webpackClientStats) {
          res.locals = res.locals || Object.create(null)
          res.locals.webpackClientStats = webpackClientStats
        }

        requestHandler(req, res)
      }
    },
    setupCompiler = (compiler) => {
      compiler.plugin('done', (stats) => {
        logger.info(stats.toString(options.stats))
        logger.info('>>> compilation done!')
      })

      compiler.plugin('failed', () => {
        logger.error('>>> compilation failed!')
      })

      compiler.plugin('invalid', () => {
        logger.info('>>> file changed')
      })

      compiler.plugin('watch-close', () => {
        logger.info('>>> stop watching')
      })
    }
  } = uconfig

  const decorateServer = uconfig.decorateServer || ((httpServer) => {
    decorateRequestHandler(httpServer, requestDecorator)
  })

  const compiler = udk(options.webpackConfig)
  const client = findForClient(compiler)
  const server = findForServer(compiler)
  const clientAndServerAreFound = !!client && !!server

  let serverMod
  let watching
  let webpackClientStats

  bindExitHandler(() => {
    watching && watching.close()
  })

  compiler.plugin('watch-close', () => {
    serverMod && serverMod.close && serverMod.close()

    serverMod = undefined
    webpackClientStats = undefined
  })

  setupCompiler && setupCompiler(compiler)

  watching = compiler.watch({}, (err, stats) => {
    if (clientAndServerAreFound) {
      const clientStats = getStatsByCompiler(client, stats)
      const serverStats = getStatsByCompiler(server, stats)
      const serverEntry = getOutputPathByChunkName(serverStats, options.serverEntry)

      if (clientStats) {
        webpackClientStats = clientStats.toJson(options.stats)
      }

      if (!err && !stats.hasErrors()) {
        if (options.serverAutoRestart && serverMod) {
          serverMod.close && serverMod.close()
          serverMod = undefined
        }

        if (!serverMod) {
          try {
            serverMod = requireES6Module(serverEntry)
          } catch (e) {
            onServerError && onServerError(e)
          }

          decorateServer(serverMod)
        }
      }
    }
  })
}

exports = module.exports = Object.assign(createDevContainer.bind(), {
  CONTAINER_PROCESS_TITLE,
  DEV_CONTAINER_METAFILES,
  EXIT_SIGNALS,
  WEBPACK_METAFILES,
  UdkDevContainer,
  bindExitHandler,
  configureOptionsDefaulter,
  createDevContainer,
  decorateRequestHandler,
  findForClient,
  findForServer,
  findForTarget,
  getOutputPathByChunkName,
  getStatsByCompiler,
  parseOptionContext,
  parseOptionMetafiles,
  parseOptionProcess,
  parseOptionStats,
  parseOptionWatch,
  parseOptionWebpackConfig,
  parseOptions,
  requireES6Module,
  resolveDevContainerConfigPath
})
