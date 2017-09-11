const Watchpack2 = require('./Watchpack2')
const childProcess = require('child_process')
const killer = require('killer')

class WatchpackFork extends Watchpack2 {
  constructor (options) {
    let {fork} = options

    if (typeof fork === 'string') {
      fork = {modulePath: fork}
    }

    fork = Object.assign({
      args: process.argv.slice(2)
    }, fork)

    super(options)

    this.fork = fork
  }

  close (callback) {
    const done = () => {
      this.child = undefined

      callback && callback()
    }

    return super.close(() => {
      if (!this.child) {
        return done()
      }

      killer(this.child.pid, done)
    })
  }

  watch (callback) {
    return super.watch(() => {
      if (!this.child) {
        const {
          modulePath,
          args,
          options
        } = this.fork

        this.child = childProcess.fork(modulePath, args, options)
      }

      callback && callback()
    })
  }
}

module.exports = WatchpackFork
