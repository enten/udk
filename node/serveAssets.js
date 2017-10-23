const {readFileSync} = require('fs')
const {resolve} = require('path')

function createRequestDecorator (stats) {
  return (req, res, next) => {
    res.locals = res.locals || Object.create(null)
    res.locals.webpackClientStats = stats

    next && next()
  }
}

function serveAssets (router, options = {}) {
  if (typeof options === 'string') {
    options = {outputPath: options}
  }

  if (typeof arguments[2] === 'function') {
    options.requestDecorator = arguments[2]
  }

  const {
    hideSourceMaps = true,
    hideStats = true,
    outputPath,
    publicPath = '/',
    statsFilename = 'stats.json',
    serveStatic,
    requestDecorator = createRequestDecorator
  } = options

  const statsPath = resolve(outputPath, statsFilename)
  const stats = JSON.parse(readFileSync(statsPath, 'utf8'))

  const decorateRequest = requestDecorator(stats)
  const serve = serveStatic(outputPath)

  if (hideSourceMaps) {
    router.use(publicPath, (req, res, next) => {
      if (req.url.endsWith('.map')) {
        return res.sendStatus(403)
      }

      next()
    })
  }

  if (hideStats) {
    router.use(publicPath + statsFilename, (req, res) => {
      res.sendStatus(403)
    })
  }

  router.use(publicPath, serve)
  router.use(decorateRequest)
}

exports = module.exports = serveAssets.bind()
exports.createRequestDecorator = createRequestDecorator
exports.serveAssets = serveAssets
