const AsyncSeriesHook = require('tapable/lib/AsyncSeriesHook')
const getDebugger = require('./debug')
const isCompilerV4 = require('./isCompilerV4')

const COMPAT_PLUGINS_MAP = {
  v3: {
    'afterEnvironment': 'after-environment',
    'entryOption': 'entry-option',
    'afterPlugins': 'after-plugins',
    'afterResolvers': 'after-resolvers',
    'beforeRun': 'before-run',
    'watchRun': 'watch-run',
    'normalModuleFactory': 'normal-module-factory',
    'contextModuleFactory': 'context-module-factory',
    'beforeCompile': 'before-compile',
    'thisCompilation': 'this-compilation',
    'afterCompile': 'after-compile',
    'shouldEmit': 'should-emit',
    'needAdditionalPass': 'need-additional-pass',
    'afterEmit': 'after-emit',
    'watchClose': 'watch-close'
  },
  v4: {
    'after-environment': 'afterEnvironment',
    'entry-option': 'entryOption',
    'after-plugins': 'afterPlugins',
    'after-resolvers': 'afterResolvers',
    'before-run': 'beforeRun',
    'watch-run': 'watchRun',
    'normal-module-factory': 'normalModuleFactory',
    'context-module-factory': 'contextModuleFactory',
    'before-compile': 'beforeCompile',
    'this-compilation': 'thisCompilation',
    'after-compile': 'afterCompile',
    'should-emit': 'shouldEmit',
    'need-additional-pass': 'needAdditionalPass',
    'after-emit': 'afterEmit',
    'watch-close': 'watchClose'
  }
}

function compatPlugin(compiler, stageName, pluginName, tapMethod, plugin) {
  if (typeof tapMethod === 'function') {
    plugin = tapMethod
    tapMethod = undefined
  }

  tapMethod = tapMethod || 'tap'

  if (isCompilerV4(compiler)) {
    stageName = COMPAT_PLUGINS_MAP.v4[stageName] || stageName

    if (!(stageName in compiler.hooks)) {
      const pluginArgNames = (
        (plugin + '')
          // remove comments
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*?[\r\n]/g, '')
          // match params
          .match(/\(([\s\S]*?)\)/)
        // give an empty string when no params matched
        || [0, '']
      // match names
      )[1].match(/[$\w]+/g)
      || [];

      getDebugger('udk', compiler.options.name, 'cpl')('add async series hook %o with params %o', stageName, pluginArgNames)

      compiler.hooks[stageName] = new AsyncSeriesHook(pluginArgNames)
    }

    compiler.hooks[stageName][tapMethod](pluginName, (...args) => {
      let result

      try {
        result = plugin(...args)
      } catch (err) {
        result = Promise.reject(err)
      }

      return result
    })
  } else {
    stageName = COMPAT_PLUGINS_MAP.v3[stageName] || stageName

    compiler.plugin(stageName, plugin)
  }
}

module.exports = compatPlugin