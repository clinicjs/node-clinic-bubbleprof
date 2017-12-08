'use strict'
const stream = require('stream')

class FilterSourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (node, encoding, callback) {
    // * If a SourceNode doesn't have a stack trace it is because it has been
    //   filtered in the `logger.js`.
    // * TIMERWRAP are not really valuable to as they purely describe an
    //   implementation detail in nodecore and never have any children as
    //   triggerAsyncId.
    if (node.hasStackTrace() && node.type !== 'TIMERWRAP') this.push(node)
    callback(null)
  }
}

module.exports = FilterSourceNodes
