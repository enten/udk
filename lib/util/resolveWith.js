const moduleExists = require('./moduleExists')

const {
  isAbsolute,
  resolve
} = require('path')

function resolveWith (modPath, options = {}) {
  if (Array.isArray(modPath)) {
    return modPath.map((mod) => {
      if (typeof mod === 'string') {
        mod = resolveWith(mod, options)
      }

      return mod
    })
  }

  const context = options.context || '.'
  const fallback = [].concat(options.fallback || [])

  if (!modPath) {
    modPath = fallback.reduce((acc, name) => {
      if (!acc) {
        let pathTried = name

        if (!isAbsolute(pathTried)) {
          pathTried = resolve(context, pathTried)
        }

        if (moduleExists(pathTried)) {
          acc = pathTried
        }
      }

      return acc
    }, undefined)
  }

  if (typeof modPath === 'string' && !isAbsolute(modPath)) {
    modPath = resolve(context, modPath)
  }

  if (typeof modPath === 'string') {
    modPath = require.resolve(modPath)
  }

  return modPath
}

module.exports = resolveWith