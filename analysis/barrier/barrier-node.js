'use strict'

const util = require('util')

class BarrierNode {
  constructor (barrierId, parentBarrierId) {
    this.barrierId = barrierId
    this.parentBarrierId = parentBarrierId

    // Wrappers are not barriers, but they can be turned into bairrers later.
    // The tree will be initialized as being just wrappers. The barriers
    // are then created later in the pipeline.
    this.initialized = false
    this.isRoot = false
    this.isWrapper = null
    this.nodes = []
    this.children = []
  }

  [util.inspect.custom] (depth, options) {
    const nestedOptions = Object.assign({}, options, {
      depth: depth === null ? null : depth - 1
    })
    if (depth === null) depth = Infinity

    if (depth < 0) {
      return `<${options.stylize('BarrierNode', 'special')}>`
    }

    const nodesPadding = ' '.repeat(8)
    const nodesFormatted = this.nodes
      .map(function (aggregateNode) {
        return nodesPadding + util.inspect(aggregateNode, nestedOptions)
          .split('\n')
          .join('\n' + nodesPadding)
      })
      .join(',\n')
    const childrenFormatted = this.children
      .map((child) => options.stylize(child, 'number'))
      .join(', ')

    return `<${options.stylize('BarrierNode', 'special')}` +
           ` isWrapper:${options.stylize(this.isWrapper, 'boolean')},` +
           ` children:[${childrenFormatted}],` +
           ` nodes:[\n${nodesFormatted}]>`
  }

  toJSON () {
    return {
      barrierId: this.barrierId,
      parentBarrierId: this.parentBarrierId,
      isWrapper: this.isWrapper,
      children: this.children,
      nodes: this.nodes.map((aggregateNode) => aggregateNode.toJSON())
    }
  }

  unwrapNode () {
    if (!this.isWrapper) {
      throw new Error(`trying to unwrap non-wrap barrierNode: ${this.barrierId}`)
    }

    return this.nodes[0]
  }

  makeBarrier () {
    // Make this barrier a real barrier
    this.isWrapper = false
  }

  initializeAsWrapper (aggregateNode, children) {
    if (this.initialized) {
      throw new Error(`can not reinitialize BarrierNode: ${this.barrierId}`)
    }

    this.initialized = true
    this.isRoot = aggregateNode.isRoot
    this.isWrapper = true
    this.nodes.push(aggregateNode)
    this.children.push(...children)
  }

  initializeAsCombined (nodes, children) {
    if (this.initialized) {
      throw new Error(`can not reinitialize BarrierNode: ${this.barrierId}`)
    }

    this.initialized = true
    this.isWrapper = false
    this.nodes.push(...nodes)
    this.children.push(...children)
  }

  combineChildren (barrierChildrenNodes) {
    // assert that all input children are already children
    for (const barrierChildNode of barrierChildrenNodes) {
      if (!this.children.includes(barrierChildNode.barrierId)) {
        throw new Error(`${barrierChildNode.barrierId} is not an child of ${this.barrierId}`)
      }
    }

    // extract barrierIds and internalNodes
    const barrierChildrenInternalNodes = []
    const barrierChildrenChildren = []
    const barrierChildrenIds = []
    for (const barrierChildNode of barrierChildrenNodes) {
      barrierChildrenInternalNodes.push(...barrierChildNode.nodes)
      barrierChildrenChildren.push(...barrierChildNode.children)
      barrierChildrenIds.push(barrierChildNode.barrierId)
    }

    // remove children from this barrier
    this.children = this.children.filter(
      (barrierChildId) => !barrierChildrenIds.includes(barrierChildId)
    )

    // Create new barrier
    const combinedChildBarrierNode = new BarrierNode(
      Math.min(...barrierChildrenIds), this.barrierId
    )
    combinedChildBarrierNode.initializeAsCombined(
      barrierChildrenInternalNodes, barrierChildrenChildren
    )

    // add new combined barrier as a child
    this.children.push(combinedChildBarrierNode.barrierId)

    // return the new barrier, so it can be pushed to the data stream
    return combinedChildBarrierNode
  }
}

module.exports = BarrierNode
