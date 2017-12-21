'use strict'
const stream = require('stream')
const StackTrace = require('./stack-trace.js')

class WrapAsStackTrace extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (data, encoding, callback) {
    callback(null, new StackTrace(data))
  }
}

module.exports = WrapAsStackTrace
