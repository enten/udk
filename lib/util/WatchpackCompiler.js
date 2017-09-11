const Watchpack2 = require('./Watchpack2')

class WatchpackCompiler extends Watchpack2 {
  constructor (options) {
    const {
      getCompiler,
      handler
    } = options

    super(options)

    this.getCompiler = getCompiler
    this.handler = handler
  }

  close (callback) {
    const done = () => {
      this.compiler = undefined
      this.compilerWatching = undefined

      callback && callback()
    }

    return super.close(() => {
      if (!this.compilerWatching) {
        return done()
      }

      this.compilerWatching.close(done)
    })
  }

  watch (callback) {
    const watchOptions = Object.assign({}, this.watcherOptions, {
      aggregateTimeout: this.aggregateTimeout
    })

    return super.watch(() => {
      try {
        this.compiler = this.getCompiler()
        this.compilerWatching = this.compiler.watch(watchOptions, this.handler)
      } catch (err) {
        this.handler(err)
      } finally {
        callback && callback()
      }
    })
  }
}

module.exports = WatchpackCompiler
