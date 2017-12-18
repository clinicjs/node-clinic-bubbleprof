'use strict'

const StackTrace = require('../stack-trace/stack-trace.js')
const TraceEvent = require('../trace-event/trace-event.js')

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
    if (!(data instanceof StackTrace)) {
      throw new TypeError('data must be a StackTrace instance')
    }

    return new RawEvent('stackTrace', data)
  }

  static wrapTraceEvent (data) {
    if (!(data instanceof TraceEvent)) {
      throw new TypeError('data must be a TraceEvent instance')
    }

    return new RawEvent('traceEvent', data)
  }
}

module.exports = RawEvent
