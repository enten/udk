const TARGET = {
  node: [
    'node'
  ],
  web: [
    undefined,
    'web'
  ]
}

function findForTarget (target, obj, options = {}) {
  if (obj && Array.isArray(obj.stats)) {
    obj = obj.stats
  }

  if (obj && Array.isArray(obj.compilers)) {
    obj = obj.compilers
  }

  if (obj && !Array.isArray(obj) && options.many) {
    obj = [obj]
  }

  if (obj && Array.isArray(obj)) {
    const newOptions = Object.assign({}, options, {many: false})

    if (options.one) {
      return obj.find((value) => findForTarget(target, value, newOptions))
    }

    return obj
      .map((value) => findForTarget(target, value, newOptions))
      .filter((value) => value)
  }

  if (obj) {
    let value = obj
    let isFound = false

    if (value && value.compilation) {
      value = value.compilation
    }

    if (value && value.options) {
      value = value.options
    }

    if (value) {
      if (Array.isArray(target) && ~target.indexOf(value.target)) {
        isFound = true
      } else if (value.target === target) {
        isFound = true
      }
    }

    if (isFound) {
      return obj
    }
  }
}

findForTarget.TARGET = TARGET

Object.keys(TARGET).forEach((key) => {
  findForTarget[key] = findForTarget.bind(null, TARGET[key])
})

module.exports = findForTarget