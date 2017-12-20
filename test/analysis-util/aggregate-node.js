'use strict'

const AggregateNode = require('../../analysis/aggregate/aggregate-node.js')
const FakeSourceNode = require('./source-node.js')

class FakeAggregateNode extends AggregateNode {
  constructor (data) {
    super(data.aggregateId, data.parentAggregateId)

    if (data.isRoot) {
      this.makeRoot()
    }

    if (data.children) {
      for (const childAggregateId of data.children) {
        this.addChild(childAggregateId)
      }
    }

    if (data.type || data.frames) {
      this.addSourceNode(new FakeSourceNode({
        asyncId: data.aggregateId,
        frames: data.frames,
        type: data.type,
        triggerAsyncId: data.parentAggregateId,
        executionAsyncId: data.parentAggregateId,
        init: 1,
        destroy: 2,
        identifier: data.aggregateId.toString()
      }))
    }

    if (data.mark) {
      this.mark.set(0, data.mark[0])
      this.mark.set(1, data.mark[1])
      this.mark.set(2, data.mark[2])
    }
  }
}

module.exports = FakeAggregateNode
