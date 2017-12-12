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

  _transform (node, encoding, done) {
    if (node.mark[0] === 'root') {
      return done(null, node)
    }

    const fileFrames = node.frames.filter((frame) => frame.fileName)

    // If there is no stack, the handle is created in C++. Check if
    // it is a nodecore handle.
    if (fileFrames.length === 0 && this.systemInfo.providers.has(node.type)) {
      node.mark[0] = 'nodecore' // second party
      return done(null, node)
    }

    // There is a stack, check if it is purely internal to nodecore.
    if (fileFrames.every((frame) => frame.isNodecore(this.systemInfo))) {
      node.mark[0] = 'nodecore' // second party
      return done(null, node)
    }

    // Analyse only users frames
    if (fileFrames.every((frame) => frame.isExternal(this.systemInfo))) {
      node.mark[0] = 'external' // third party
      return done(null, node)
    }

    // The frame is not nodecore nor external, assume it is relevant to
    // the user.
    node.mark[0] = 'user' // first party
    return done(null, node)
  }
}

module.exports = MarkPartyAggregateNodes
