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
    if (aggregateNode.isRoot) {
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

    // There are no frames, but the provider was not from nodecore. Assume
    // it is created by an external module.
    if (fileFrames.length === 0) {
      aggregateNode.mark.set(0, 'external') // third party
      return done(null, aggregateNode)
    }

    // There is a stack, check if it is purely internal to nodecore.
    if (fileFrames.every((frame) => frame.isNodecore(this.systemInfo))) {
      aggregateNode.mark.set(0, 'nodecore') // second party
      return done(null, aggregateNode)
    }

    // If frames are external (includes modecore), but not all are nodecore
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
