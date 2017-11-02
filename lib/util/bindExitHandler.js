const EXIT_SIGNALS = {
  'exit': undefined,
  'SIGINT': 130,
  'SIGTERM': 143
}

function bindExitHandler (handler, options = {}) {
  if (typeof options === 'string') {
    options = [options]
  }

  if (Array.isArray(options)) {
    options = {events: options}
  }

  options = Object.assign({
    events: EXIT_SIGNALS
  }, options)

  let called

  Object.keys(options.events).forEach((event) => {
    process.on(event, (...args) => {
      if (!called) {
        let code = options.events[event]

        if (event === 'exit') {
          code = args[0]
        }

        if (code == null) {
          code = -1
        }

        called = true
        handler(event, ...args)
        process.exit(code)
      }
    })
  })
}

module.exports = Object.assign(bindExitHandler.bind(), {
  EXIT_SIGNALS,
  default: bindExitHandler,
  bindExitHandler
})