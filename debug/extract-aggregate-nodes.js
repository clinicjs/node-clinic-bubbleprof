'use strict'
const stream = require('stream')

class ExtractAggregateNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (node, encoding, callback) {
    for (const aggregateNode of node.nodes) {
      this.push(aggregateNode)
    }

    callback(null)
  }
}

module.exports = ExtractAggregateNodes
