'use strict'

class RawEvent {
  constructor (type, info) {
    this.type = type
    this.info = info
  }

  toJSON () {
    return {
      type: this.type,
      info: this.info
    }
  }

  static wrapStackTrace (data) {
    return new RawEvent('stackTrace', data)
  }

  static wrapTraceEvents (data) {
    return new RawEvent('traceEvents', data)
  }
}

module.exports = RawEvent
