function ensureConfigHasEntry (webpackConfig, entry, entryOptions, options = {}) {
  if (Array.isArray(webpackConfig)) {
    return webpackConfig.forEach((wconfig) => ensureConfigHasEntry(wconfig, entry, entryOptions, options))
  }

  if (Array.isArray(entry)) {
    return entry.forEach((e) => ensureConfigHasEntry(webpackConfig, e, entryOptions, options))
  }

  if (Array.isArray(options)) {
    options = {topModuleEntries: options}
  }

  if (webpackConfig.entry) {
    if (typeof webpackConfig.entry === 'string') {
      webpackConfig.entry = [webpackConfig.entry]
    }

    let append = false

    if (entry[0] === '+') {
      entry = entry.substring(1)
      append = true
    }

    const hasEntry = webpackConfig.entry.find((e) => {
      return !!e && e.startsWith(entry)
    })

    if (!hasEntry) {
      if (typeof entryOptions === 'object') {
        entryOptions = Object.keys(entryOptions)
          .map((key) => `${key}=${entryOptions[key]}`)
          .join('&')
      }

      if (entryOptions) {
        entry = `${entry}?${entryOptions}`
      }

      const topModuleEntries = webpackConfig.entry.filter((e) => {
        return (options.topModuleEntries || []).find((topModuleEntry) => {
          if (e) {
            if (typeof topModuleEntry === 'string') {
              return e.startsWith(topModuleEntry)
            }

            if (topModuleEntry && typeof topModuleEntry.test === 'function') {
              return topModuleEntry.test(e)
            }
          }

          return false
        })
      })

      const entries = webpackConfig.entry.filter((e) => {
        return topModuleEntries.indexOf(e) === -1
      })

      entries[append ? 'push' : 'unshift'].call(entries, entry)

      if (topModuleEntries.length) {
        entries.unshift.apply(entries, topModuleEntries)
      }

      webpackConfig.entry.length = 0
      webpackConfig.entry.push.apply(webpackConfig.entry, entries)
    }
  }

  return webpackConfig
}

module.exports = ensureConfigHasEntry
