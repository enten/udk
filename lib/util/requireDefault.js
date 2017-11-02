function requireDefault (modulePath, options = {}) {
  const {
    cache = true
  } = options

  if (cache == false && require.cache[modulePath]) {
    delete require.cache[modulePath]
  }

  const mod = require(modulePath)

  return mod && mod.default || mod
}

module.exports = requireDefault
