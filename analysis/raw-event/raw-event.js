'use strict'

const StackTrace = require('./stack-trace.js')
const TraceEvent = require('./trace-event.js')

class RawEvent {
  constructor (type, info) {
    this.type = type
    this.info = info
  }

  toJSON () {
    return {
      type: this.type,
      info: this.info.toJSON()
    }
  }

  static wrapStackTrace (data) {
    return new RawEvent('stackTrace', new StackTrace(data))
  }

  static wrapTraceEvents (data) {
    return new RawEvent('traceEvents', new TraceEvent(data))
  }
}

module.exports = RawEvent
