const {readFileSync} = require('fs')
const {resolve} = require('path')

function createStatsInjector (stats) {
  return (req, res, next) => {
    res.locals = res.locals || Object.create(null)
    res.locals.webpackStats = Object.assign({}, res.locals.webpackStats, stats)

    next && next()
  }
}

function serveAssets (router, options = {}) {
  if (typeof options === 'string') {
    options = {outputPath: options}
  }

  if (typeof arguments[2] === 'function') {
    options.injectStats = arguments[2]
  }

  const {
    hideSourceMaps = true,
    hideStats = true,
    injectStats = createStatsInjector,
    name,
    outputPath,
    publicPath = '/',
    statsFilename = 'stats.json',
    serveStatic
  } = options

  const statsPath = resolve(outputPath, statsFilename)
  let stats = JSON.parse(readFileSync(statsPath, 'utf8'))

  if (name) {
    stats = {[name]: stats}
  }

  const decorateRequest = injectStats(stats)
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

module.exports = Object.assign(serveAssets.bind(), {
  createStatsInjector,
  serveAssets
})
