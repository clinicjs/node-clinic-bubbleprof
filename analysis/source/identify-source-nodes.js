'use strict'
const stream = require('stream')

class IdentifySourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (sourceNode, encoding, callback) {
    if (sourceNode.type === 'HTTPPARSER') {
      // HTTPPARSER can either a new allocated HTTPPARSER or a previusely
      // cached one. We don't want to sepreate these two cases, as this is
      // a nodecore implementation detail. Thus, ignore the stackTrace in
      // the identifier.
      sourceNode.setIdentifier('HTTPPARSER')
    } else if (sourceNode.frames.length === 0) {
      // TCPWRAP and perhaps some other cases, don't have a stack trace.
      // Identify those with just their provider type
      sourceNode.setIdentifier(sourceNode.type)
    } else {
      sourceNode.setIdentifier(
        `${sourceNode.type}\f${sourceNode.frames.formatPositionOnly()}`
      )
    }

    callback(null, sourceNode)
  }
}

module.exports = IdentifySourceNodes
