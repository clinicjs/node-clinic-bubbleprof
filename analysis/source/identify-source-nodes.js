'use strict'
const stream = require('stream')

class IdentifySourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (node, encoding, callback) {
    if (node.type === 'HTTPPARSER') {
      // HTTPPARSER can either a new allocated HTTPPARSER or a previusely
      // cached one. We don't want to sepreate these two cases, as this is
      // a nodecore implementation detail. Thus, ignore the stackTrace in
      // the identifier.
      node.setIdentifier('HTTPPARSER')
    } else if (node.frames.length === 0) {
      // TCPWRAP and perhaps some other cases, don't have a stack trace.
      // Identify those with just their provider type
      node.setIdentifier(node.type)
    } else {
      node.setIdentifier(`${node.type}\f${node.positionalStackTrace()}`)
    }

    callback(null, node)
  }
}

module.exports = IdentifySourceNodes
