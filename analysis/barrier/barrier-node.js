'use strict'

const util = require('util')

class BarrierNode {
  constructor (barrierId, parentBarrierId) {
    this.barrierId = barrierId
    this.parentBarrierId = parentBarrierId

    // Wrappers are not barriers, but they can be turned into bairrers later.
    // The tree will be initialized as being just wrappers. The barriers
    // are then created later in the pipeline.
    this.isWrapper = null
    this.nodes = []
    this.children = []
  }

  makeWrapper(node, children) {
    this.isWrapper = true
    this.nodes.push(node)
    this.children.push(...children)
  }

  makeCombined(nodes, children) {
    this.isWrapper = false
    this.nodes.push(...node)
    this.children.push(...children)
  }

  combineChildren(barrierNodes) {
    // assert that all input children are already children
    for (const barrierNode of barrierNodes) {
      if (!this.children.includes(barrierNode.barrierId)) {
        throw new Error(`${barrierNode.barrierId} is not an child of ${this.barrierId}`)
      }
    }

    // extract barrierIds and internalNodes
    const internalNodes = []
    const barrierIds = []
    const barrierChildren = []
    for (const barrierNode of barrierNodes) {
      barrierIds.push(barrierNode.barrierId)
      internalNodes.push(...barrierNode.nodes)
      barrierChildren.push(...barrierNode.children)
    }

    // remove children from this barrier
    this.children = this.children.filter(
      (childBarrierId) => !barrierIds.includes(childBarrierId)
    )

    // Create new barrier
    const combinedChildBarrier = new BarrierNode(
      Math.min(...barrierIds), this.barrierId
    )
    combinedChildBarrier.makeCombined(internalNodes, barrierChildren)

    // return the new barrier, so it can be pushed to the data stream
    return combinedChildBarrier
  }
}

module.exports = BarrierNode
