const URL_BASE_REGEX = /(^\w+:|^)\/\/([^\/]*)/

function getOutputPublicPath (obj, options = {}) {
  options = Object.assign({
    endsSlash: false,
    pathOnly: true,
    startsSlash: true
  }, options)

  let publicPath

  if (obj && typeof obj === 'object') {
    if (obj.compilation) {
      obj = obj.compilation
    }

    if (obj.compiler) {
      obj = obj.compiler
    }

    if (obj.options) {
      obj = obj.options
    }

    if (obj.output) {
      obj = obj.output
    }

    if (obj.publicPath) {
      obj = obj.publicPath
    }
  }

  if (typeof obj === 'string') {
    publicPath = obj
  }

  if (!publicPath) {
    publicPath = '/'
  }

  if (publicPath !== '/') {
    if (options.pathOnly) {
      publicPath = publicPath.replace(URL_BASE_REGEX, '')
    }

    if (!URL_BASE_REGEX.test(publicPath)) {
      if (options.startsSlash && !publicPath.startsWith('/')) {
        publicPath = '/' + publicPath
      }

      if (!options.startsSlash) {
        while (publicPath.startsWith('/')) {
          publicPath = publicPath.substring(1)
        }
      }
    }

    if (options.endsSlash && !publicPath.endsWith('/')) {
      publicPath = publicPath + '/'
    }

    if (!options.endsSlash && publicPath !== '/') {
      while (publicPath.endsWith('/')) {
        publicPath = publicPath.substring(0, publicPath.length - 1)
      }
    }
  }

  return publicPath
}

module.exports = getOutputPublicPath