'use strict'

const fs = require('fs')
const path = require('path')
const stream = require('stream')
const protobuf = require('protocol-buffers')

const messages = protobuf(
  fs.readFileSync(path.resolve(__dirname, 'stack-trace.proto'))
)

const FRAME_PREFIX_SIZE = 2 // uint16 is 2 bytes

class StackTraceEncoder extends stream.Transform {
  constructor (options) {
    super(Object.assign({
      readableObjectMode: false,
      writableObjectMode: true
    }, options))
  }

  _transform (message, encoding, callback) {
    const messageLength = messages.StackTrace.encodingLength(message)

    const framedMessage = Buffer.alloc(messageLength + FRAME_PREFIX_SIZE)
    framedMessage.writeUInt16BE(messageLength, 0)
    messages.StackTrace.encode(message, framedMessage, FRAME_PREFIX_SIZE)

    callback(null, framedMessage)
  }
}

module.exports = StackTraceEncoder
