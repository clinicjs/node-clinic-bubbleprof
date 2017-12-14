'use strict'
const stream = require('stream')

class MarkPartyAggregateNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo
  }

  _transform (aggregateNode, encoding, done) {
    if (aggregateNode.mark.get(0) === 'root') {
      return done(null, aggregateNode)
    }

    const fileFrames = aggregateNode.frames.filter((frame) => frame.fileName)

    // If there is no stack, the handle is created in C++. Check if
    // it is a nodecore handle.
    if (fileFrames.length === 0 &&
        this.systemInfo.providers.has(aggregateNode.type)) {
      aggregateNode.mark.set(0, 'nodecore') // second party
      return done(null, aggregateNode)
    }

    // There is a stack, check if it is purely internal to nodecore.
    if (fileFrames.every((frame) => frame.isNodecore(this.systemInfo))) {
      aggregateNode.mark.set(0, 'nodecore') // second party
      return done(null, aggregateNode)
    }

    // Analyse only users frames
    if (fileFrames.every((frame) => frame.isExternal(this.systemInfo))) {
      aggregateNode.mark.set(0, 'external') // third party
      return done(null, aggregateNode)
    }

    // The frame is not nodecore nor external, assume it is relevant to
    // the user.
    aggregateNode.mark.set(0, 'user') // first party
    return done(null, aggregateNode)
  }
}

module.exports = MarkPartyAggregateNodes
