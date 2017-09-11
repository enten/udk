const Watchpack = require('watchpack')

class Watchpack2 extends Watchpack {
  constructor (options) {
    const {
      files,
      directories
    } = options

    super(options)

    this.files = [].concat(files || [])
    this.directories = [].concat(directories || [])
  }

  close (callback) {
    super.close()

    callback && callback()
  }

  pause (callback) {
    super.pause()

    callback && callback()
  }

  watch (callback) {
    super.watch(this.files, this.directories)

    callback && callback()
  }
}

module.exports = Watchpack2