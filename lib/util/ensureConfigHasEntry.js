function ensureConfigHasEntry (webpackConfig, entry, entryQuery, options = {}) {
  if (Array.isArray(webpackConfig)) {
    return webpackConfig.map((value) => ensureConfigHasEntry(value, entry, entryQuery, options))
  }

  if (Array.isArray(entry)) {
    entry.forEach((e) => ensureConfigHasEntry(webpackConfig, e, entryQuery, options))

    return webpackConfig
  }

  return insertEntry(webpackConfig, 'entry', entry, entryQuery, options)
}

function formatPathWithQuery (path, query) {
  if (query && typeof query === 'object') {
    query = Object.keys(query)
      .map((key) => `${key}=${query[key]}`)
      .join('&')
  }

  if (query) {
    path = `${path}?${query}`
  }

  return path
}

function inModule (moduleName, entry) {
  if (typeof entry !== 'string') {
    return false
  }

  while (entry.endsWith('/') || entry.endsWith('\\')) {
    entry = entry.substring(0, entry.length - 1)
  }

  return entry === moduleName
    || entry.startsWith(moduleName + '/')
    || entry.startsWith(moduleName + '\\')
    || entry.startsWith(moduleName + '?')
    || (moduleName.test && moduleName.test(entry))
}

function insertEntry (obj, key, entry, entryQuery, options = {}) {
  if (!obj[key]) {
    obj[key] = []
  }

  if (typeof obj[key] === 'string') {
    obj[key] = [obj[key]]
  }

  if (!Array.isArray(obj[key])) {
    Object.keys(obj[key]).forEach((entryName) => {
      insertEntry(obj[key], entryName, entry, entryQuery, options)
    })

    return obj
  }

  const entries = obj[key]
  let {
    append,
    topModuleEntries
  } = options

  if (entry[0] === '+') {
    entry = entry.substring(1)
    append = true
  }

  const hasEntry = entries.find((e) => inModule(entry, e))

  if (!hasEntry) {
    entry = formatPathWithQuery(entry, entryQuery)
    topModuleEntries = [].concat(topModuleEntries || [])

    const topEntries = entries.filter((e) => {
      return topModuleEntries.find((topEntry) => inModule(topEntry, e))
    })

    const nextEntries = entries.filter((e) => {
      return topEntries.indexOf(e) === -1
    })

    nextEntries[append ? 'push' : 'unshift'].call(nextEntries, entry)

    if (topEntries.length) {
      nextEntries.unshift.apply(nextEntries, topEntries)
    }

    entries.length = 0
    entries.push.apply(entries, nextEntries)
  }

  return obj
}

module.exports = Object.assign(ensureConfigHasEntry.bind(), {
  ensureConfigHasEntry,
  formatPathWithQuery,
  inModule,
  insertEntry
})
