'use strict'

const SourceNode = require('../../analysis/source/source-node.js')
const StackTrace = require('../../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../../analysis/trace-event/trace-event.js')

function has (object, property) { return Object.prototype.hasOwnProperty.call(object, property) }

class FakeSourceNode extends SourceNode {
  constructor (data) {
    super(data.asyncId)

    if (data.frames) {
      this.addStackTrace(new StackTrace({
        asyncId: data.asyncId,
        frames: data.frames
      }))
    }

    if (data.init) {
      this.addTraceEvent(new TraceEvent({
        event: 'init',
        type: data.type,
        asyncId: data.asyncId,
        triggerAsyncId: data.triggerAsyncId,
        executionAsyncId: data.executionAsyncId,
        timestamp: data.init
      }))
    }

    const before = has(data, 'before') ? data.before : []
    const after = has(data, 'after') ? data.after : []

    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (i < before.length) {
        this.addTraceEvent(new TraceEvent({
          event: 'before',
          type: data.type,
          asyncId: data.asyncId,
          timestamp: before[i]
        }))
      }

      if (i < after.length) {
        this.addTraceEvent(new TraceEvent({
          event: 'after',
          type: data.type,
          asyncId: data.asyncId,
          timestamp: after[i]
        }))
      }
    }

    if (data.destroy) {
      this.addTraceEvent(new TraceEvent({
        event: 'destroy',
        type: data.type,
        asyncId: data.asyncId,
        timestamp: data.destroy
      }))
    }

    if (data.identifier) {
      this.setIdentifier(data.identifier)
    }
  }
}

module.exports = FakeSourceNode
