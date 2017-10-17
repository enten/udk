function moduleExists (path) {
  let result = false

  try {
    require.resolve(path)
    result = true
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND' || err.message.indexOf(`'${path}'`) === -1) {
      throw err
    }
  }

  return result
}

module.exports = moduleExists