function runSeries (arr, fn, callback) {
  if (!callback) {
    callback = () => {}
  }

  let error
  let isSync = true

  const callFn = (value, next) => {
    if (error) {
      return next()
    }

    fn(value, (err) => {
      if (err) {
        error = err
      }

      next()
    })
  }

  const run = arr.slice(0).reverse().reduce(
    (next, value) => () => {
      const caller = callFn.bind(null, value, next)

      if (isSync) {
        isSync = false

        return process.nextTick(caller)
      }

      caller()
    },
    () => callback(error)
  )

  run()
}

module.exports = runSeries
