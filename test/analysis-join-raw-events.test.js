'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const JoinAsRawEvents = require('../analysis/raw-event/join-as-raw-events.js')

test('join raw events order', function (t) {
  const stackTrace = startpoint([
    new StackTrace({ asyncId: 1, frames: [] }),
    new StackTrace({ asyncId: 2, frames: [] }),
    new StackTrace({ asyncId: 3, frames: [] })
  ], { objectMode: true })

  const traceEvent = startpoint([
    new TraceEvent({ asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 1,
      timestamp: 2,
      event: 'before',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null }),
    new TraceEvent({ asyncId: 2,
      timestamp: 3,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 1,
      timestamp: 4,
      event: 'after',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null }),
    new TraceEvent({ asyncId: 3,
      timestamp: 5,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 2,
      timestamp: 6,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null }),
    new TraceEvent({ asyncId: 1,
      timestamp: 7,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null }),
    new TraceEvent({ asyncId: 3,
      timestamp: 8,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null })
  ], { objectMode: true })

  new JoinAsRawEvents(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data.map((rawEvent) => rawEvent.toJSON()), [
        {
          type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 1,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'stackTrace',
          info: { asyncId: 1, frames: [] } },
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 2,
            event: 'before',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } },
        { type: 'traceEvent',
          info: { asyncId: 2,
            timestamp: 3,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'stackTrace',
          info: { asyncId: 2, frames: [] } },
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 4,
            event: 'after',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } },
        { type: 'traceEvent',
          info: { asyncId: 3,
            timestamp: 5,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'stackTrace',
          info: { asyncId: 3, frames: [] } },
        { type: 'traceEvent',
          info: { asyncId: 2,
            timestamp: 6,
            event: 'destroy',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } },
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 7,
            event: 'destroy',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } },
        { type: 'traceEvent',
          info: { asyncId: 3,
            timestamp: 8,
            event: 'destroy',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } }
      ])
      t.end()
    }))
})

test('join raw events - earily stackTrace end', function (t) {
  const stackTrace = startpoint([
    new StackTrace({ asyncId: 1, frames: [] })
  ], { objectMode: true })

  const traceEvent = startpoint([
    new TraceEvent({ asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 2,
      timestamp: 2,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 3,
      timestamp: 3,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 })
  ], { objectMode: true })

  new JoinAsRawEvents(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data.map((rawEvent) => rawEvent.toJSON()), [
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 1,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'stackTrace',
          info: { asyncId: 1, frames: [] } },
        { type: 'traceEvent',
          info: { asyncId: 2,
            timestamp: 2,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'traceEvent',
          info: { asyncId: 3,
            timestamp: 3,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } }
      ])
      t.end()
    }))
})

test('join raw events - earily traceEvent end', function (t) {
  const stackTrace = startpoint([
    new StackTrace({ asyncId: 1, frames: [] }),
    new StackTrace({ asyncId: 2, frames: [] }),
    new StackTrace({ asyncId: 3, frames: [] })
  ], { objectMode: true })

  const traceEvent = startpoint([
    new TraceEvent({ asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0 }),
    new TraceEvent({ asyncId: 1,
      timestamp: 2,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null })
  ], { objectMode: true })

  new JoinAsRawEvents(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data.map((rawEvent) => rawEvent.toJSON()), [
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 1,
            event: 'init',
            type: 'custom',
            triggerAsyncId: 0,
            executionAsyncId: 0 } },
        { type: 'stackTrace',
          info: { asyncId: 1, frames: [] } },
        { type: 'traceEvent',
          info: { asyncId: 1,
            timestamp: 2,
            event: 'destroy',
            type: 'custom',
            triggerAsyncId: null,
            executionAsyncId: null } },
        { type: 'stackTrace',
          info: { asyncId: 2, frames: [] } },
        { type: 'stackTrace',
          info: { asyncId: 3, frames: [] } }
      ])
      t.end()
    }))
})
