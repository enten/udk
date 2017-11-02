const {resolve} = require('path')

function getEntryOutputPathFromStats (stats, assetName) {
  if (!assetName) {
    assetName = Object.keys(stats.compilation.assets)[0]
  }

  if (assetName) {
    return resolve(stats.compilation.compiler.options.output.path, assetName)
  }
}

module.exports = getEntryOutputPathFromStats