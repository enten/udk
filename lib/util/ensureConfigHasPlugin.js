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

  const {plugins} = webpackConfig

  if (plugins) {
    const hasPlugin = plugins.find((p) => {
      return !!p && p instanceof plugin
    })

    if (!hasPlugin) {
      pluginOptions = Object.assign({}, pluginOptions)
      const pluginInstance = new plugin(pluginOptions)

      plugins.push(pluginInstance)
    }
  }
}

module.exports = ensureConfigHasPlugin
