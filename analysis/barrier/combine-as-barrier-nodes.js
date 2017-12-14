'use strict'
const stream = require('stream')
const BarrierNode = require('./barrier-node.js')

class CombineAsBarrierNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (node, encoding, callback) {
    const barrier = new BarrierNode(node.nodeId, node.parentNodeId)
    barrier.initializeAsWrapper(node, node.children)
    callback(null, barrier)
  }
}

module.exports = CombineAsBarrierNodes
