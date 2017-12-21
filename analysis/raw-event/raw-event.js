'use strict'

const StackTrace = require('../stack-trace/stack-trace.js')
const TraceEvent = require('../trace-event/trace-event.js')

class RawEvent {
  constructor (type, asyncId, info) {
    this.type = type
    this.asyncId = asyncId
    this.info = info
  }

  toJSON () {
    return {
      type: this.type,
      asyncId: this.asyncId,
      info: this.info.toJSON()
    }
  }

  static wrapStackTrace (stackTrace) {
    if (!(stackTrace instanceof StackTrace)) {
      throw new TypeError('wrapStackTrace input must be a StackTrace instance')
    }

    return new RawEvent('stackTrace', stackTrace.asyncId, stackTrace)
  }

  static wrapTraceEvent (traceEvent) {
    if (!(traceEvent instanceof TraceEvent)) {
      throw new TypeError('wrapTraceEvent input must be a TraceEvent instance')
    }

    return new RawEvent('traceEvent', traceEvent.asyncId, traceEvent)
  }
}

module.exports = RawEvent
