'use strict'

const BarrierNode = require('../../analysis/barrier/barrier-node.js')
const FakeAggregateNode = require('./aggregate-node.js')

class FakeBarrierNode extends BarrierNode {
  constructor (data) {
    super(data.barrierId, data.parentBarrierId)

    const nodes = data.nodes.map((nodeData) => new FakeAggregateNode(nodeData))

    if (data.name) {
      this.setName(data.name)
    }

    if (data.nodes.length === 1) {
      this.initializeAsWrapper(nodes[0], data.children)
      if (!data.isWrapper) this.makeBarrier()
    }

    if (data.nodes.length > 1) {
      this.initializeAsCombined(nodes, data.children)
    }
  }
}

module.exports = FakeBarrierNode
