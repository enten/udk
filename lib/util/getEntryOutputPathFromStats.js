const {join} = require('path')

function getEntryOutputPathFromStats (stats, options = {}) {
  if (typeof options === 'string') {
    options = {entryName: options}
  }

  let {
    entryName,
    outputPath
  } = options

  let entryFiles
  let entryOutputPath

  if (stats.compilation) {
    const {entrypoints} = stats.compilation
    let entry

    // Compatibility note:
    // * in webpack4, entrypoints is a Map object
    // * in webpack3, entrypoints is a plain object
    if (!entry && typeof entrypoints.get === 'function') {
      entry = entryName
        ? entrypoints.get(entryName)
        : entrypoints.get('main')
        || entrypoints.get('index')
        || entrypoints.get('server')
    } else {
      entry = entryName
        ? entrypoints[entryName]
        : entrypoints.main
        || entrypoints.index
        || entrypoints.server
    }

    if (!outputPath) {
      outputPath = stats.compilation.outputOptions.path
    }

    if (entry) {
      entryChunk = entry.chunks.find((chunk) => chunk.name === entry.name)

      if (entryChunk) {
        entryFiles = entryChunk.files
      }
    }
  }

  if (!entryFiles && stats.chunks && stats.entrypoints) {
    const {
      chunks,
      entrypoints
    } = stats

    if (!entryName) {
      entryName = entrypoints.main ? 'main' : entrypoints.index ? 'index' : entrypoints.server ? 'server' : undefined
    }

    const entry = entrypoints[entryName]

    if (entry) {
      entryFiles = entry.chunks
        .map((chunkId) => chunks.find((chunk) => chunk.id === chunkId))
        .filter((chunk) => chunk && chunk.names && ~chunk.names.indexOf(entryName))
        .reduce((acc, chunk) => acc.concat(chunk.files || []), [])
    }
  }

  if (!entryFiles && stats.assetsByChunkName && stats.chunks) {
    const {assetsByChunkName} = stats

    entryFiles = entryName ? assetsByChunkName[entryName] : assetsByChunkName.main || assetsByChunkName.index || assetsByChunkName.server
  }

  if (!entryFiles && stats.assets) {
    const {assets} = stats

    entryFiles = []
      .concat(entryName || ['main', 'index', 'server'])
      .map((chunkName) => assets.filter((asset) => ~asset.chunkNames.indexOf(chunkName)))
      .reduce((acc, value) => value.map((asset) => asset.name), [])
  }

  if (entryFiles) {
    entryOutputPath = entryFiles.find((file) => file.endsWith('.js'))
  }

  if (entryOutputPath && outputPath) {
    entryOutputPath = join(outputPath, entryOutputPath)
  }

  return entryOutputPath
}

module.exports = getEntryOutputPathFromStats
