function getOutputPublicPath (obj, options = {}) {
  options = Object.assign({
    startsSlash: true,
    endsSlash: false
  }, options)

  let publicPath

  if (typeof obj === 'string') {
    obj = {publicPath: obj}
  }

  if (obj && obj.compilation) {
    obj = obj.compilation
  }

  if (obj && obj.compiler) {
    obj = obj.compiler
  }

  if (obj && obj.options) {
    obj = obj.options
  }

  if (obj && obj.output) {
    obj = obj.output
  }

  if (obj && obj.publicPath) {
    publicPath = obj.publicPath
  }

  if (!publicPath) {
    publicPath = '/'
  }

  if (publicPath !== '/') {
    if (options.startsSlash && !publicPath.startsWith('/')) {
      publicPath = '/' + publicPath
    }

    if (!options.startsSlash) {
      while (publicPath.startsWith('/')) {
        publicPath = publicPath.substring(1)
      }
    }

    if (options.endsSlash && !publicPath.endsWith('/')) {
      publicPath = publicPath + '/'
    }

    if (!options.endsSlash) {
      while (publicPath.endsWith('/')) {
        publicPath = publicPath.substring(0, publicPath.length - 1)
      }
    }
  }

  return publicPath
}

module.exports = getOutputPublicPath