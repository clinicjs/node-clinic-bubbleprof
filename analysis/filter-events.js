'use strict'
const stream = require('stream')

class FilterEvents extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (node, encoding, callback) {
    if (node.hasStackTrace() && node.type !== 'TIMERWRAP') this.push(node)
    callback(null)
  }
}

module.exports = FilterEvents
