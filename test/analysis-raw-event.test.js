'use strict'

const test = require('tap').test
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const RawEvent = require('../analysis/raw-event/raw-event.js')

test('Raw Event - type check', function (t) {
  const stackTraceObject = new StackTrace({ asyncId: 1, frames: [] })
  const traceEventObject = new TraceEvent({
    asyncId: 1,
    timestamp: 1,
    event: 'init',
    type: 'custom',
    triggerAsyncId: 0,
    executionAsyncId: 0
  })

  t.throws(
    () => RawEvent.wrapTraceEvent(stackTraceObject),
    new TypeError('wrapTraceEvent input must be a TraceEvent instance')
  )

  t.throws(
    () => RawEvent.wrapStackTrace(traceEventObject),
    new TypeError('wrapStackTrace input must be a StackTrace instance')
  )

  t.end()
})
