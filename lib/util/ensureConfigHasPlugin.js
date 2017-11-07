function ensureConfigHasPlugin (webpackConfig, plugin, pluginOptions) {
  if (Array.isArray(webpackConfig)) {
    return webpackConfig.forEach((wconfig) => ensureConfigHasPlugin(wconfig, plugin, pluginOptions))
  }

  if (Array.isArray(plugin)) {
    return plugin.forEach((p) => ensureConfigHasPlugin(webpackConfig, p, pluginOptions))
  }

  if (typeof plugin === 'string') {
    plugin = require(plugin)
  }

  if (!webpackConfig.plugins) {
    webpackConfig.plugins = []
  }

  const hasPlugin = webpackConfig.plugins.find((p) => {
    return !!p && p instanceof plugin
  })

  if (!hasPlugin) {
    pluginOptions = Object.assign({}, pluginOptions)
    const pluginInstance = new plugin(pluginOptions)

    webpackConfig.plugins.push(pluginInstance)
  }
}

module.exports = ensureConfigHasPlugin
