const Watchpack = require('watchpack')

class Watchpack2 extends Watchpack {
  close (callback) {
    super.close()

    callback && callback()
  }

  pause (callback) {
    super.pause()

    callback && callback()
  }

  watch (callback) {
    const files = [].concat(this.options.files || [])
    const directories = [].concat(this.options.directories || [])

    super.watch(files, directories)

    callback && callback()
  }
}

module.exports = Watchpack2