const Stats = require('webpack/lib/Stats')
const compatPlugin = require('./util/compatPlugin')
const decorateEventListener = require('./util/decorateEventListener')
const ensureConfigHasEntry = require('./util/ensureConfigHasEntry')
const ensureConfigHasPlugin = require('./util/ensureConfigHasPlugin')
const findForTarget = require('./util/findForTarget')
const getEntryOutputPathFromStats = require('./util/getEntryOutputPathFromStats')
const getOutputPublicPath = require('./util/getOutputPublicPath')
const isCompilerV4 = require('./util/isCompilerV4')
const moduleExists = require('./util/moduleExists')
const requireDefault = require('./util/requireDefault')
const resolveWith = require('./util/resolveWith')
const supportsColor = require('supports-color')

const {
  Runtime,
  exportContainerRuntime
} = require('./util/container')

const BUNDLE_AVAILABLE_EVENT = 'bundle-available'
const CONTAINER_PROCESS_TITLE = 'udk-ctnr'
const DEV_CONTAINER_CONFIG_NAMES = [
  'udk.container',
  'udkfile',
  'udk.config',
]
const TOP_MODULE_ENTRIES = [
  'source-map-support'
]
const WEBPACK_CONFIG_NAMES = [
  'webpack.config',
  'webpackfile'
]

exportContainerRuntime(module, {
  getConfigFallbackNames () {
    return DEV_CONTAINER_CONFIG_NAMES
  },
  getConfigDefaulter (configPath) {
    const defaulter = Runtime.getConfigDefaulter.call(this, configPath)

    defaulter.set('autoRestart', false)
    defaulter.set('bundleAvailableEvent', BUNDLE_AVAILABLE_EVENT)
    defaulter.set('hmr', 'call', this.parseConfigHMR.bind(this))
    defaulter.set('metafiles', ['package.json'])
    defaulter.set('processTitle', CONTAINER_PROCESS_TITLE)
    defaulter.set('stats', 'call', this.parseConfigStats.bind(this))
    defaulter.set('statsToJson', 'call', this.parseConfigStatsToJson.bind(this))
    defaulter.set('statsToString', 'call', this.parseConfigStatsToString.bind(this))
    defaulter.set('topModuleEntries', TOP_MODULE_ENTRIES)
    defaulter.set('webpackConfig', 'call', this.parseConfigWebpackConfig.bind(this))

    defaulter.set('jsonifyCompilerStats', function (stats) {
      return stats.toJson(this.statsToJson)
    })

    defaulter.set('printCompilerError', function (err) {
      this.logger && this.logger.error(err)
    })

    defaulter.set('printCompilerStats', function (stats) {
      this.logger && this.logger.info(this.stringifyCompilerStats(stats))
    })

    defaulter.set('stringifyCompilerStats', function (stats) {
      return stats.toString(this.statsToString)
    })

    return defaulter
  },
  getWatchpackOptionDirs (container) {
    return Runtime.getWatchpackOptionDirs.call(this, container).concat(
      container.config.metadirs || []
    )
  },
  getWatchpackOptionFiles (container) {
    return Runtime.getWatchpackOptionFiles.call(this, container).concat(
      container.config.webpackConfig || [],
      container.config.metafiles || []
    )
  },
  async getWebpackConfig (webpackConfig) {
    if (typeof webpackConfig === 'string') {
      webpackConfig = require(webpackConfig)
    }

    if (Array.isArray(webpackConfig)) {
      webpackConfig = webpackConfig.map((cfg) => {
        if (typeof cfg === 'string') {
          cfg = require(cfg)
        }

        return cfg
      })
    }

    if (typeof webpackConfig === 'function') {
      return this.getWebpackConfig(webpackConfig())
    }

    if (webpackConfig && typeof webpackConfig.then === 'function') {
      return webpackConfig.then(this.getWebpackConfig.bind(this))
    }

    return webpackConfig
  },
  parseConfigHMR (value, config) {
    if (typeof value === 'undefined') {
      value = true
    }

    if (typeof value === 'string') {
      value = {path: value}
    }

    if (value) {
      value = Object.assign({
        hotPollInterval: 1000,
      }, value)

      value.hotMiddleware = Object.assign({
        log: config.logger.info.bind(config.logger),
        path: '/__webpack_hmr'
      }, value.hotMiddleware)

      value.hotMiddlewareClient = Object.assign({}, value.hotMiddlewareClient, {
        path: value.hotMiddleware.path
      })

      value.plugin = Object.assign({}, value.plugin)
    }

    return value
  },
  parseConfigStats (value, config) {
    if (typeof value === 'boolean' || typeof value === 'string') {
      return Stats.presetToOptions(value)
    }

    return Object.assign({}, value)
  },
  parseConfigStatsToJson (value, config) {
    if (typeof value === 'boolean' || typeof value === 'string') {
      value = Stats.presetToOptions(value)
    }

    return Object.assign({source: false}, config.stats, value)
  },
  parseConfigStatsToString (value, config) {
    if (typeof value === 'boolean' || typeof value === 'string') {
      value = Stats.presetToOptions(value)
    }

    return Object.assign({colors: supportsColor}, config.stats, value)
  },
  parseConfigWebpackConfig (value, config) {
    if (!value || typeof value === 'string') {
      value = resolveWith(value, {
        context: config.context,
        fallback: WEBPACK_CONFIG_NAMES
      })
    }

    if (Array.isArray(value)) {
      value = webpackConfig = resolveWith(value, {
        context: config.context
      })
    }

    return value
  },
  prepareWebpackCompiler(config, compiler) {
    config.prepareCompiler && config.prepareCompiler(compiler)

    config.onCompilerWatchRun && compatPlugin(compiler, 'watchRun', 'UDKCConfigWatchRunPlugin', config.onCompilerWatchRun.bind(config))
    config.onCompilerBeforeCompile && compatPlugin(compiler, 'beforeCompile', 'UDKCConfigBeforeCompilePlugin', config.onCompilerBeforeCompile.bind(config))
    config.onCompilerCompile && compatPlugin(compiler, 'compile', 'UDKCConfigCompilePlugin', config.onCompilerCompile.bind(config))
    config.onCompilerThisCompilation && compatPlugin(compiler, 'thisCompilation', 'UDKCConfigThisCompilationPlugin', config.onCompilerThisCompilation.bind(config))
    config.onCompilerCompilation && compatPlugin(compiler, 'compilation', 'UDKCConfigCompilationPlugin', config.onCompilerCompilation.bind(config))
    config.onCompilerMake && compatPlugin(compiler, 'make', 'UDKCConfigMakePlugin', config.onCompilerMake.bind(config))
    config.onCompilerAfterCompile && compatPlugin(compiler, 'afterCompile', 'UDKCConfigAfterCompilePlugin', config.onCompilerAfterCompile.bind(config))
    config.onCompilerShouldEmit && compatPlugin(compiler, 'shouldEmit', 'UDKCConfigShouldEmitPlugin', config.onCompilerShouldEmit.bind(config))
    config.onCompilerNeedAdditionalPass && compatPlugin(compiler, 'needAdditionalPass', 'UDKCConfigNeedAdditionalPassPlugin', config.onCompilerNeedAdditionalPass.bind(config))
    config.onCompilerEmit && compatPlugin(compiler, 'emit', 'UDKCConfigEmitPlugin', config.onCompilerEmit.bind(config))
    config.onCompilerAfterEmit && compatPlugin(compiler, 'afterEmit', 'UDKCConfigAfterEmitPlugin', config.onCompilerAfterEmit.bind(config))
    config.onCompilerDone && compatPlugin(compiler, 'done', 'UDKCConfigDonePlugin', config.onCompilerDone.bind(config))
    config.onCompilerFailed && compatPlugin(compiler, 'failed', 'UDKCConfigFailedPlugin', config.onCompilerFailed.bind(config))
    config.onCompilerInvalid && compatPlugin(compiler, 'invalid', 'UDKCConfigInvalidPlugin', config.onCompilerInvalid.bind(config))
    config.onCompilerWatchClose && compatPlugin(compiler, 'watchClose', 'UDKCConfigWatchClosePlugin', config.onCompilerWatchClose.bind(config))
  },
  prepareWebpackConfig (config, webpackConfig) {
    const nodeConfigs = findForTarget.node(webpackConfig, {many: true})

    const {
      autoRestart,
      beforeRequireNodeBundle,
      bundleAvailableEvent,
      requestDecorator
    } = config

    ;[].concat(webpackConfig).forEach((obj) => {
      if (obj && !obj.plugins) {
        obj.plugins = []
      }
    })

    nodeConfigs.forEach((nodeConfig) => {
      nodeConfig.plugins.push(function () {
        let bundleMod

        compatPlugin(this, 'done', 'UDKCNodeCompilerDonePlugin', (stats) => {
          if (!stats.hasErrors()) {
            if (autoRestart && bundleMod) {
              bundleMod.close && bundleMod.close()
              bundleMod = undefined
            }

            if (!bundleMod) {
              const entryOutputPath = getEntryOutputPathFromStats(stats)

              if (moduleExists(entryOutputPath)) {
                beforeRequireNodeBundle && beforeRequireNodeBundle(entryOutputPath, stats)

                // Fixture to that babel-polyfill doesn't throw error
                // "only one instance of babel-polyfill is allowed""
                if (global._babelPolyfill) {
                  global._babelPolyfill = false
                }

                try {
                  bundleMod = requireDefault(entryOutputPath, {cache: false})

                  requestDecorator && requestDecorator(bundleMod, stats)

                  if (isCompilerV4(this)) {

                    this.hooks[bundleAvailableEvent].promise(bundleMod, stats)
                      // .catch(console.error)
                  } else {
                    this.applyPlugins(bundleAvailableEvent, bundleMod, stats)
                  }
                } catch (e) {
                  process.nextTick(() => config.logger.error(e))
                }
              }
            }
          }
        })
      })
    })

    this.tryPrepareWebpackStatsInjection(config, webpackConfig)
    this.tryPrepareServeWebAssets(config, webpackConfig)
    this.tryPrepareExtremeHMR(config, webpackConfig)

    config.prepareWebpackConfig && config.prepareWebpackConfig(webpackConfig)
  },
  shutDownContainer (proc, config, event, ...args) {
    config.compilerWatcher && config.compilerWatcher.close()

    Runtime.shutDownContainer.call(this, proc, config, event, ...args)
  },
  async shutUpContainer (proc, config) {
    await Runtime.shutUpContainer.call(this, proc, config)

    this.debug('get webpack config')

    const webpackConfig = await this.getWebpackConfig(config.webpackConfig)

    this.debug('prepare webpack config')

    this.prepareWebpackConfig(config, webpackConfig)

    this.debug('create compiler')

    const compiler = require('./udk')(webpackConfig)

    this.debug('prepare compiler')

    this.prepareWebpackCompiler(config, compiler)

    config.compiler = compiler

    config.compilerWatcher = compiler.watch(this.watchOptions, (err, stats) => {
      this.debug('compiler watching')

      err && config.printCompilerError && config.printCompilerError(err)
      stats && config.printCompilerStats && config.printCompilerStats(stats)

      config.onCompilerWatching && config.onCompilerWatching(err, stats)
    })
  },
  tryPrepareExtremeHMR (config, webpackConfig) {
    if (!config.hmr) {
      return
    }

    const dbug = this.debug

    const {
      autoRestart,
      bundleAvailableEvent,
      hmr,
      topModuleEntries
    } = config

    const hmrEntries = [].concat(hmr.entries || ['main', 'index'])
    const hmrEntriesNode = [].concat(hmr.entriesNode || 'server', hmrEntries)
    const hmrEntriesWeb = [].concat(hmr.entriesNode || 'browser', hmrEntries)

    const hmrPluginNode = Object.assign({}, hmr.plugin, hmr.pluginNode)
    const hmrPluginWeb = Object.assign({}, hmr.plugin, hmr.pluginWeb)

    let nodeConfigs = findForTarget.node(webpackConfig, {many: true})
    let webConfigs = findForTarget.web(webpackConfig, {many: true})

    if (hmr.configs) {
      nodeConfigs = nodeConfigs.filter(({name}) => hmr.configs.indexOf(name) !== -1)
      webConfigs = webConfigs.filter(({name}) => hmr.configs.indexOf(name) !== -1)
    }

    ensureConfigHasPlugin(webpackConfig, 'webpack/lib/NoEmitOnErrorsPlugin')

    ensureConfigHasPlugin(webConfigs, 'webpack/lib/HotModuleReplacementPlugin', hmrPluginWeb)

    if (!autoRestart) {
      ensureConfigHasPlugin(nodeConfigs, 'webpack/lib/HotModuleReplacementPlugin', hmrPluginNode)
      ensureConfigHasEntry(nodeConfigs, 'webpack/hot/poll', hmr.hotPollInterval, {
        entriesFilter: hmrEntriesNode,
        topModuleEntries
      })
    }

    webConfigs.forEach((webConfig) => {
      const {name} = webConfig
      const hotMiddlewareOptions = Object.assign({}, hmr.hotMiddlewareClient, {name})

      ensureConfigHasEntry(webConfig, 'webpack-hot-middleware/client', hotMiddlewareOptions, {
        entriesFilter: hmrEntriesWeb,
        topModuleEntries
      })
    })

    nodeConfigs.forEach((nodeConfig) => {
      nodeConfig.plugins.push(function () {
        let hotMiddleware

        compatPlugin(this, bundleAvailableEvent, 'UDKCNodeHMRPlugin', (bundleMod, stats) => {
          decorateEventListener('request', bundleMod, (listener) => {
            dbug('decorate %s with webpack-hot-middleware', nodeConfig.name)

            if (!hotMiddleware) {
              dbug('create webpack-hot-middleware %O', hmr.hotMiddleware)

              hotMiddleware = require('webpack-hot-middleware')(config.compiler, hmr.hotMiddleware)
            }

            return (req, res) => {
              hotMiddleware(req, res, () => listener(req, res))
            }
          })
        })
      })
    })
  },
  tryPrepareServeWebAssets (config, webpackConfig) {
    const dbug = this.debug
    const {bundleAvailableEvent} = config

    const nodeConfigs = findForTarget.node(webpackConfig, {many: true})
    const webConfigs = findForTarget.web(webpackConfig, {many: true})

    nodeConfigs.forEach((nodeConfig) => {
      nodeConfig.plugins.push(function () {
        let serveStatic = []

        compatPlugin(this, bundleAvailableEvent, 'UDKCNodeServeWebAssetsPlugin', (bundleMod, stats) => {
          webConfigs.forEach((webConfig, index) => {
            const publicPath = getOutputPublicPath(webConfig, {
              endsSlash: false,
              pathOnly: true,
              startsSlash: true
            })

            decorateEventListener('request', bundleMod, (listener) => {
              dbug('decorate %s to service %s assets at %o', nodeConfig.name, webConfig.name, publicPath)

              if (!serveStatic[index]) {
                dbug('create serve-static %o', webConfig.output.path)

                serveStatic[index] = require('serve-static')(webConfig.output.path, {index: false})
              }

              return (req, res) => {
                if (req.url && req.url.startsWith(publicPath)) {
                  const originalUrl = req.url

                  if (originalUrl !== '/') {
                    req.url = originalUrl.substring(publicPath.length)
                  }

                  return serveStatic[index](req, res, () => {
                    req.url = originalUrl

                    listener(req, res)
                  })
                }

                listener(req, res)
              }
            })
          })
        })
      })
    })
  },
  tryPrepareWebpackStatsInjection (config, webpackConfig) {
    const dbug = this.debug
    const {bundleAvailableEvent} = config
    const webpackStats = {}

    const nodeConfigs = findForTarget.node(webpackConfig, {many: true})
    const webConfigs = findForTarget.web(webpackConfig, {many: true})

    webConfigs.forEach((webConfig) => {
      webConfig.plugins.push(function () {
        compatPlugin(this, 'done', 'UDKCWebStatsInjectionPlugin', (stats) => {
          dbug('update %s stats', webConfig.name)

          const statsJson = config.jsonifyCompilerStats(stats)

          webpackStats[webConfig.name] = statsJson
        })
      })
    })

    nodeConfigs.forEach((nodeConfig) => {
      nodeConfig.plugins.push(function () {
        compatPlugin(this, bundleAvailableEvent, 'UDKCNodeStatsInjectionPlugin', (bundleMod, stats) => {
          decorateEventListener('request', bundleMod, (listener) => {
            dbug('decorate %s to inject webpack stats', nodeConfig.name)

            return (req, res) => {
              dbug('inject webpack stats %o', Object.keys(webpackStats))

              if (config.injectWebpackStats) {
                config.injectWebpackStats(webpackStats, req, res)
              } else {
                res.locals = res.locals || Object.create(null)
                res.locals.webpackStats = Object.assign({}, res.locals.webpackStats, webpackStats)
              }

              listener(req, res)
            }
          })
        })
      })
    })
  }
})
