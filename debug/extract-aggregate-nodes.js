'use strict'
const stream = require('../lib/destroyable-stream')

class ExtractAggregateNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (clusterNode, encoding, callback) {
    for (const aggregateNode of clusterNode.nodes) {
      this.push(aggregateNode)
    }

    callback(null)
  }
}

module.exports = ExtractAggregateNodes
