const OptionsDefaulter = require('webpack/lib/OptionsDefaulter')
const WatchpackFork = require('./WatchpackFork')
const bindExitHandler = require('./bindExitHandler')
const createDebugger = require('./debug')
const requireDefault = require('./requireDefault')
const resolveWith = require('./resolveWith')

const {
  dirname,
  isAbsolute,
  resolve
} = require('path')

let dbug = createDebugger('udk', 'ctnr')

const Runtime = {
  get debug () {
    return dbug
  },
  bootstrapContainer (proc, configPath) {
    this.debug('bootstrap container %o', configPath)

    const config = this.getConfig(configPath)

    proc.on('uncaughtException', (config.onUncaughtException || (config.logger || console).error).bind(config))
    proc.on('unhandledRejection', (config.onUnhandledRejection || (config.logger || console).error).bind(config))

    bindExitHandler(this.shutDownContainer.bind(this, proc, config))

    if (config.processTitle) {
      proc.title = config.processTitle
    }

    config.bootstrap && config.bootstrap(proc, configPath)

    this.shutUpContainer(proc, config)

    return config
  },
  closeContainer (container, callback) {
    this.debug('close container')

    const done = () => callback && callback()

    if (!container.watcher) {
      return done()
    }

    container.watcher.close(() => {
      container.config = undefined
      container.watcher = undefined

      done()
    })
  },
  getConfig (configPath) {
    const config = requireDefault(configPath, {cache: false})

    this.getConfigDefaulter(configPath).process(config)

    return config
  },
  getConfigDefaulter (configPath) {
    const defaulter = new OptionsDefaulter()

    defaulter.set('__filename', 'call', () => configPath)
    defaulter.set('__dirname', 'call', () => dirname(configPath))
    defaulter.set('context', 'call', this.parseConfigContext.bind(this))
    defaulter.set('logger', 'call', this.parseConfigLogger.bind(this))
    defaulter.set('watchOptions', this.parseConfigWatchOptions.bind(this))

    return defaulter
  },
  getConfigFallbackNames () {
    return []
  },
  getWatchpackOptionFiles (container) {
    return [container.configPath]
  },
  getWatchpackOptions (container) {
    const forkModule = __filename
    const forkArgs = process.argv.slice(2).concat(container.configPath, container.runtimePath)
    const watchFiles = this.getWatchpackOptionFiles(container)
      .map((filePath) => {
        if (typeof filePath === 'string' && !isAbsolute(filePath)) {
          filePath = resolve(container.config.context, filePath)
        }

        return filePath
      })
      .filter((filePath, index, arr) => {
        return typeof filePath === 'string' && arr.indexOf(filePath) === index
      })

    return Object.assign({}, container.config.watchOptions, {
      files: watchFiles,
      fork: {
        modulePath: forkModule,
        args: forkArgs
      },
      restartAfterAggregation: false
    })
  },
  parseConfigContext  (value, config) {
    if (!value) {
      value = config.__dirname
    }

    if (!isAbsolute(value)) {
      value = resolve(config.__dirname, value)
    }

    return value
  },
  parseConfigLogger (value, config) {
    return value || console
  },
  parseConfigWatchOptions (value, config) {
    return Object.assign({}, value)
  },
  resolveConfigPath (...args) {
    let configPath
      
    if (args.length) {
      configPath = resolve(...args)
    }

    return resolveWith(configPath, {
      fallback: this.getConfigFallbackNames && this.getConfigFallbackNames()
    })
  },
  runContainer (container, callback) {
    if (container.watcher) {
      return this.closeContainer(container, () => {
        this.runContainer(container, callback)
      })
    }

    this.debug('run container')

    const {
      configPath,
      runtime
    } = container

    container.config = this.getConfig(configPath)
    container.watcher = new WatchpackFork(this.getWatchpackOptions(container))

    container.watcher.on('aggregated', () => {
      process.nextTick(() => this.runContainer(container))
    })

    container.watcher.watch(() => callback && callback())
  },
  shutDownContainer (proc, config, event, ...args) {
    this.debug('container down')

    config.onDown && config.onDown(event, ...args)
  },
  shutUpContainer (proc, config) {
    this.debug('container up')

    config.onUp && config.onUp(proc)
  }
}

function assembleContainerRuntime (runtimePath, requireOptions) {
  const defaulter = new OptionsDefaulter()
  const runtime = requireDefault(runtimePath, requireOptions)

  Object.keys(Runtime).forEach((key) => {
    defaulter.set(key, Runtime[key])
  })

  defaulter.process(runtime)

  return runtime
}

function createContainer (runtimePath, ...args) {
  dbug('create container')

  const runtime = assembleContainerRuntime(runtimePath, {cache: true})
  const configPath = runtime.resolveConfigPath(...args)
  const container = {configPath, runtimePath}

  dbug(container)

  return {
    get config () {
      return container.config
    },
    get configPath () {
      return container.configPath
    },
    get watcher () {
      return container.watcher
    },
    close: runtime.closeContainer.bind(runtime, container),
    run: runtime.runContainer.bind(runtime, container)
  }
}

function exportContainerRuntime (mod, runtime) {
  const create = createContainer.bind(null, mod.filename)

  create.extendRuntime = (extensionMod, extensionRuntime) => {
    extensionRuntime = Object.assign({}, runtime, extensionRuntime)

    return exportContainerRuntime(extensionMod, extensionRuntime)
  }

  mod.exports = Object.assign(create, runtime)
}

Object.assign(exports, {
  Runtime,
  assembleContainerRuntime,
  createContainer,
  exportContainerRuntime
})

if (require.main === module && process.send) {
  dbug = createDebugger('udk', 'ctnr', 'fork')

  const runtimePath = process.argv.pop()
  const configPath = process.argv.pop()

  const runtime = assembleContainerRuntime(runtimePath, {cache: false})

  runtime.bootstrapContainer(process, configPath)
}