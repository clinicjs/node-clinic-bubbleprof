'use strict'

class TraceEvent {
  constructor (data) {
    this.asyncId = data.asyncId
    this.event = data.event
    this.type = data.type
    this.timestamp = data.timestamp
    this.triggerAsyncId = data.triggerAsyncId
    this.executionAsyncId = data.executionAsyncId
  }

  toJSON () {
    return {
      asyncId: this.asyncId,
      event: this.event,
      type: this.type,
      timestamp: this.timestamp,
      triggerAsyncId: this.triggerAsyncId,
      executionAsyncId: this.executionAsyncId
    }
  }
}

module.exports = TraceEvent
