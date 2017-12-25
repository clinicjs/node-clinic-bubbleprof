'use strict'

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')
const AbstractEncoder = require('./abstract-encoder.js')

const messages = protobuf(
  fs.readFileSync(path.resolve(__dirname, 'stack-trace.proto'))
)

class StackTraceEncoder extends AbstractEncoder {
  constructor (options) {
    super(messages.StackTrace, options)
  }
}

module.exports = StackTraceEncoder
