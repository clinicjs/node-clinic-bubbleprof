'use strict'
const stream = require('stream')
const TraceEvent = require('./trace-event.js')

class WrapAsTraceEvent extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }

  _transform (data, encoding, callback) {
    callback(null, new TraceEvent(data))
  }
}

module.exports = WrapAsTraceEvent
