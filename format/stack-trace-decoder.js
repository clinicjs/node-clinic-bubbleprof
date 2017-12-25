'use strict'

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')
const AbstractDecoder = require('./abstract-decoder.js')

const messages = protobuf(
  fs.readFileSync(path.resolve(__dirname, 'stack-trace.proto'))
)

class StackTraceDecoder extends AbstractDecoder {
  constructor (options) {
    super(messages.StackTrace, options)
  }
}

module.exports = StackTraceDecoder
