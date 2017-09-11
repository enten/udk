const {resolve} = require('path')

function udk (configFilePath, callback) {
  if (Array.isArray(callback)) {
    configFilePath = callback.map((relativePath) => resolve(configFilePath, relativePath))
    callback = arguments[2]
  }

  if (typeof configFilePath === 'string') {
    configFilePath = require.resolve(configFilePath)
  }

  if (Array.isArray(configFilePath)) {
    configFilePath = configFilePath.map(require.resolve)
  }

  const plugins = []

  const getOptions = () => {
    if (Array.isArray(configFilePath)) {
      return configFilePath.map((filePath) => {
        if (require.cache[filePath]) {
          delete require.cache[filePath]
        }

        return require(filePath)
      })
    }

    if (require.cache[configFilePath]) {
      delete require.cache[configFilePath]
    }

    return require(configFilePath)
  }

  const getCompiler = () => {
    const compiler = require('webpack')(getOptions())

    plugins.forEach((pluginArgs) => compiler.plugin.apply(compiler, pluginArgs))

    return compiler
  }

  if (callback) {
    return getCompiler().run(callback)
  }

  return {
    plugin (...args) {
      plugins.push(args)
    },
    run: (handler) => {
      return getCompiler().run(handler)
    },
    watch: (watchOptions, handler) => {
      const WatchpackCompiler = require('./util/WatchpackCompiler')

      if (typeof watchOptions === 'boolean') {
        watchOptions = {}
      }

      watchOptions = Object.assign({}, watchOptions, {
        files: Array.isArray(configFilePath) ? configFilePath : [configFilePath],
        getCompiler,
        handler
      })

      const watchpackCompiler = new WatchpackCompiler(watchOptions)

      watchpackCompiler.on('aggregated', () => {
        watchpackCompiler.close(() => watchpackCompiler.watch())
      })

      watchpackCompiler.watch()

      return watchpackCompiler
    }
  }
}

function webpack (options, callback) {
  let isUdkSign = false

  if (typeof options === 'string') {
    isUdkSign = true
  }

  if (Array.isArray(options) && options.length) {
    isUdkSign = options.reduce((acc, x) => !acc || typeof x === 'string', true)
  }

  if (isUdkSign) {
    return udk.apply(null, arguments)
  }

  return require('webpack')(options, callback)
}

Object.keys(require('webpack')).forEach((key) => {
	const desc = Object.getOwnPropertyDescriptor(require('webpack'), key)

	Object.defineProperty(webpack, key, desc)
})

module.exports = webpack
