const {resolve} = require('path')
const webpack = require('./webpack')

function udk (options, callback) {
  if (typeof callback === 'string') {
    options = resolve(options, callback)
    callback = arguments[2]
  }

  if (Array.isArray(callback)) {
    options = callback.map((config) => {
      if (typeof config === 'string') {
        config = resolve(options, config)
      }

      return config
    })
    callback = arguments[2]
  }

  if (typeof options === 'string') {
    options = require(options)
  }

  if (Array.isArray(options)) {
    options = options.map((config) => {
      if (typeof config === 'string') {
        config = require(config)
      }

      return config
    })
  }

  return webpack(options, callback)
}

Object.keys(webpack).forEach((key) => {
  const desc = Object.getOwnPropertyDescriptor(webpack, key)

  Object.defineProperty(udk, key, desc)
})

Object.defineProperty(udk, 'WatchpackFork', {
  configurable: false,
  enumerable: true,
  get: () => require('./util/WatchpackFork')
})

module.exports = udk
