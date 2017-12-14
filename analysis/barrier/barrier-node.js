'use strict'

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

  initializeAsWrapper (node, children) {
    if (this.initialized) {
      throw new Error(`can not reinitialize BarrierNode: ${this.barrierId}`)
    }

    this.initialized = true
    this.isRoot = node.isRoot
    this.isWrapper = true
    this.nodes.push(node)
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
