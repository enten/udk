const {DepGraph} = require('dependency-graph')
const MultiCompiler = require('webpack/lib/MultiCompiler')

class MultiCompiler2 extends MultiCompiler {
  constructor (compilers) {
    if (!compilers || (!Array.isArray(compilers) && typeof compilers !== 'object')) {
      throw new Error('MultiCompiler2 accepts array of compilers only')
    }

    if (!Array.isArray(compilers)) {
      compilers = Object.keys(compilers).map((key) => {
        compilers[key].name = key // side effect

        return compilers[key]
      })
    }

    if (!compilers.length) {
      throw new Error('No compilers was given (array of compilers is empty)')
    }

    const namesDistinct = compilers.filter((c, index, arr) => {
      if (!c.name) {
        throw new Error(`Each compiler must have a name defined: compiler #${index} has none`)
      }

      return arr.find(({name}) => name === c.name) === c
    })

    if (namesDistinct.length !== compilers.length) {
      throw new Error(`Each config must have a unique name: ${compilers.map((c) => c.name).join(', ')}`)
    }

    const depGraph = getDepGraph(compilers)
    const overallOrder = depGraph.overallOrder()

    compilers = overallOrder.map((compilerName) => {
      const c = depGraph.getNodeData(compilerName)

      c._udk = { // side effect
        dependencies: depGraph.dependenciesOf(c.name)
          .sort((a, b) => overallOrder.indexOf(a) > overallOrder.indexOf(b))
          .map((name) => depGraph.getNodeData(name)),
        dependants: depGraph.dependantsOf(c.name)
          .sort((a, b) => overallOrder.indexOf(a) > overallOrder.indexOf(b))
          .map((name) => depGraph.getNodeData(name)),
        lastStats: undefined,
        watching: undefined
      }

      return c
    })

    super(compilers)

    this._udk = {depGraph}
  }

  getCompiler (name) {
    return this._udk.depGraph.getNodeData(name)
  }
}

function getDepGraph (nodes) {
  const graph = new DepGraph()

  nodes.forEach((node) => graph.addNode(node.name, node))

  nodes.forEach((node) => {
    node.dependencies && node.dependencies.forEach((dep) => {
      graph.addDependency(node.name, dep)
    })
  })

  return graph
}

module.exports = MultiCompiler2
