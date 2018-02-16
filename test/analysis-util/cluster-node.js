'use strict'

const CluterNode = require('../../analysis/cluster/cluster-node.js')
const FakeBarrierNode = require('./barrier-node.js')

class FakeClusterNode extends CluterNode {
  constructor (data) {
    super(data.clusterId, data.parentClusterId)

    if (data.isRoot) {
      this.makeRoot()
    }

    if (data.children) {
      for (const childAggregateId of data.children) {
        this.addChild(childAggregateId)
      }
    }

    if (data.nodes) {
      const barrierNode = new FakeBarrierNode({
        barrierId: data.nodes
          .map((aggregateNode) => aggregateNode.aggregateId)
          .sort((a, b) => a - b)
          .shift(),
        parentBarrierId: data.nodes
          .map((aggregateNode) => aggregateNode.parentAggregateId)
          .sort((a, b) => a - b)
          .shift(),
        children: [].concat(
          data.nodes.map((aggregateNode) => aggregateNode.children)
        ),
        nodes: data.nodes
      })

      this.insertBarrierNode(barrierNode)
    }
  }
}

module.exports = FakeClusterNode
