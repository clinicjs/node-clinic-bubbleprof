'use strict'
const stream = require('stream')
const BarrierNode = require('./barrier-node.js')

class WrapAsBarrierNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (aggregateNode, encoding, callback) {
    const barrier = new BarrierNode(
      aggregateNode.aggregateId, aggregateNode.parentAggregateId
    )
    barrier.initializeAsWrapper(aggregateNode, aggregateNode.children)
    callback(null, barrier)
  }
}

module.exports = WrapAsBarrierNodes
