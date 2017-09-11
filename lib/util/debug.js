const debug = require('debug')

const DEBUGGERS = {}

function getDebugger (...parts) {
  if (!DEBUGGERS[parts]) { // out of scope
    DEBUGGERS[parts] = debug(parts.join(':')) // side effect
  }

  return DEBUGGERS[parts] // out of scope
}

module.exports = getDebugger
