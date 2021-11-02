'use strict'

const test = require('tap').test
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const RawEvent = require('../analysis/raw-event/raw-event.js')

test('Raw Event - RawEvent.wrapTraceEvent', function (t) {
  const stackTraceObject = new StackTrace({ asyncId: 2, frames: [] })
  const traceEventObject = new TraceEvent({
    asyncId: 2,
    timestamp: 1,
    event: 'init',
    type: 'custom',
    triggerAsyncId: 1,
    executionAsyncId: 0
  })

  t.strictSame(RawEvent.wrapTraceEvent(traceEventObject).toJSON(), {
    type: 'traceEvent',
    asyncId: 2,
    info: traceEventObject.toJSON()
  })

  t.throws(
    () => RawEvent.wrapTraceEvent(stackTraceObject),
    new TypeError('wrapTraceEvent input must be a TraceEvent instance')
  )

  t.end()
})

test('Raw Event - RawEvent.wrapStackTrace', function (t) {
  const stackTraceObject = new StackTrace({ asyncId: 2, frames: [] })
  const traceEventObject = new TraceEvent({
    asyncId: 2,
    timestamp: 1,
    event: 'init',
    type: 'custom',
    triggerAsyncId: 1,
    executionAsyncId: 0
  })

  t.strictSame(RawEvent.wrapStackTrace(stackTraceObject).toJSON(), {
    type: 'stackTrace',
    asyncId: 2,
    info: stackTraceObject.toJSON()
  })

  t.throws(
    () => RawEvent.wrapStackTrace(traceEventObject),
    new TypeError('wrapStackTrace input must be a StackTrace instance')
  )

  t.end()
})
