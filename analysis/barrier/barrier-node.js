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
    this.name = null
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

    const padding = ' '.repeat(8)
    const nodesFormatted = this.nodes
      .map(function (aggregateNode) {
        return util.inspect(aggregateNode, nestedOptions)
          .split('\n')
          .join('\n' + padding)
      })

    let inner
    if (depth < 1) {
      inner = nodesFormatted.join(', ')
    } else {
      inner = `\n${padding}` + nodesFormatted.join(`,\n${padding}`)
    }

    const childrenFormatted = this.children
      .map((child) => options.stylize(child, 'number'))
      .join(', ')

    return `<${options.stylize('BarrierNode', 'special')}` +
           ` barrierId:${options.stylize(this.barrierId, 'number')},` +
           ` parentBarrierId:${options.stylize(this.parentBarrierId, 'number')},` +
           ` name:${options.stylize(this.name, 'string')},` +
           ` isWrapper:${options.stylize(this.isWrapper, 'boolean')},` +
           ` children:[${childrenFormatted}],` +
           ` nodes:[${inner}]>`
  }

  setName (name) {
    this.name = name
  }

  toJSON () {
    return {
      barrierId: this.barrierId,
      parentBarrierId: this.parentBarrierId,
      name: this.name,
      isWrapper: this.isWrapper,
      children: this.children,
      nodes: this.nodes.map((aggregateNode) => aggregateNode.toJSON())
    }
  }

  updateParentBarrierId (parentBarrierId) {
    this.parentBarrierId = parentBarrierId
  }

  updateChildren (children) {
    this.children = children.sort((a, b) => a - b)
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
    this.updateChildren(children)
  }

  initializeAsCombined (nodes, children) {
    if (this.initialized) {
      throw new Error(`can not reinitialize BarrierNode: ${this.barrierId}`)
    }

    this.initialized = true
    this.isWrapper = false
    this.nodes.push(...nodes)
    this.updateChildren(children)
  }

  combineChildren (barrierChildrenNodes) {
    // assert that all input children are already children
    for (const barrierChildNode of barrierChildrenNodes) {
      if (!this.children.includes(barrierChildNode.barrierId)) {
        throw new Error(`BarrierNode ${barrierChildNode.barrierId} is not a ` +
                        `child of BarrierNode ${this.barrierId}`)
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
    const newChildrenList = this.children.filter(
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
    newChildrenList.push(combinedChildBarrierNode.barrierId)
    this.updateChildren(newChildrenList)

    // return the new barrier, so it can be pushed to the data stream
    return combinedChildBarrierNode
  }
}

module.exports = BarrierNode
