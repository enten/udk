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

    compiler.hooks[stageName][tapMethod](pluginName, plugin)
  } else {
    stageName = COMPAT_PLUGINS_MAP.v3[stageName] || stageName

    compiler.plugin(stageName, plugin)
  }
}

module.exports = compatPlugin