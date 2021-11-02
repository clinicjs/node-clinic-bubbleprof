'use strict'

const test = require('tap').test
const async = require('async')
const stream = require('stream')
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const JoinAsRawEvent = require('../analysis/raw-event/join-as-raw-event.js')

test('Raw Event - join order', function (t) {
  const stackTraceData = [
    new StackTrace({ asyncId: 1, frames: [] }),
    new StackTrace({ asyncId: 2, frames: [] }),
    new StackTrace({ asyncId: 3, frames: [] })
  ]
  const traceEventData = [
    new TraceEvent({
      asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 1,
      timestamp: 2,
      event: 'before',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    }),
    new TraceEvent({
      asyncId: 2,
      timestamp: 3,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 1,
      timestamp: 4,
      event: 'after',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    }),
    new TraceEvent({
      asyncId: 3,
      timestamp: 5,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 2,
      timestamp: 6,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    }),
    new TraceEvent({
      asyncId: 1,
      timestamp: 7,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    }),
    new TraceEvent({
      asyncId: 3,
      timestamp: 8,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    })
  ]

  const stackTrace = startpoint(stackTraceData, { objectMode: true })
  const traceEvent = startpoint(traceEventData, { objectMode: true })

  new JoinAsRawEvent(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.error(err)

      t.strictSame(data.map((rawEvent) => rawEvent.toJSON()), [
        { type: 'traceEvent', asyncId: 1, info: traceEventData[0].toJSON() },
        { type: 'stackTrace', asyncId: 1, info: stackTraceData[0].toJSON() },
        { type: 'traceEvent', asyncId: 1, info: traceEventData[1].toJSON() },
        { type: 'traceEvent', asyncId: 2, info: traceEventData[2].toJSON() },
        { type: 'stackTrace', asyncId: 2, info: stackTraceData[1].toJSON() },
        { type: 'traceEvent', asyncId: 1, info: traceEventData[3].toJSON() },
        { type: 'traceEvent', asyncId: 3, info: traceEventData[4].toJSON() },
        { type: 'stackTrace', asyncId: 3, info: stackTraceData[2].toJSON() },
        { type: 'traceEvent', asyncId: 2, info: traceEventData[5].toJSON() },
        { type: 'traceEvent', asyncId: 1, info: traceEventData[6].toJSON() },
        { type: 'traceEvent', asyncId: 3, info: traceEventData[7].toJSON() }
      ])
      t.end()
    }))
})

test('Raw Event - join with earily stackTrace end', function (t) {
  const stackTraceData = [
    new StackTrace({ asyncId: 1, frames: [] })
  ]
  const traceEventData = [
    new TraceEvent({
      asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 2,
      timestamp: 2,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 3,
      timestamp: 3,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    })
  ]

  const stackTrace = startpoint(stackTraceData, { objectMode: true })
  const traceEvent = startpoint(traceEventData, { objectMode: true })

  new JoinAsRawEvent(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.error(err)

      t.strictSame(data.map((rawEvent) => rawEvent.toJSON()), [
        { type: 'traceEvent', asyncId: 1, info: traceEventData[0].toJSON() },
        { type: 'stackTrace', asyncId: 1, info: stackTraceData[0].toJSON() },
        { type: 'traceEvent', asyncId: 2, info: traceEventData[1].toJSON() },
        { type: 'traceEvent', asyncId: 3, info: traceEventData[2].toJSON() }
      ])
      t.end()
    }))
})

test('Raw Event - join with earily traceEvent end', function (t) {
  const stackTraceData = [
    new StackTrace({ asyncId: 1, frames: [] }),
    new StackTrace({ asyncId: 2, frames: [] }),
    new StackTrace({ asyncId: 3, frames: [] })
  ]
  const traceEventData = [
    new TraceEvent({
      asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 1,
      timestamp: 2,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    })
  ]

  const stackTrace = startpoint(stackTraceData, { objectMode: true })
  const traceEvent = startpoint(traceEventData, { objectMode: true })

  new JoinAsRawEvent(stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.error(err)

      t.strictSame(data.map((rawEvent) => rawEvent.toJSON()), [
        { type: 'traceEvent', asyncId: 1, info: traceEventData[0].toJSON() },
        { type: 'stackTrace', asyncId: 1, info: stackTraceData[0].toJSON() },
        { type: 'traceEvent', asyncId: 1, info: traceEventData[1].toJSON() },
        { type: 'stackTrace', asyncId: 2, info: stackTraceData[1].toJSON() },
        { type: 'stackTrace', asyncId: 3, info: stackTraceData[2].toJSON() }
      ])
      t.end()
    }))
})

test('Raw Event - read before available', function (t) {
  const stackTraceData = [
    new StackTrace({ asyncId: 1, frames: [] })
  ]
  const traceEventData = [
    new TraceEvent({
      asyncId: 1,
      timestamp: 1,
      event: 'init',
      type: 'custom',
      triggerAsyncId: 0,
      executionAsyncId: 0
    }),
    new TraceEvent({
      asyncId: 1,
      timestamp: 2,
      event: 'destroy',
      type: 'custom',
      triggerAsyncId: null,
      executionAsyncId: null
    })
  ]

  const stackTrace = new stream.PassThrough({ objectMode: true })
  const traceEvent = new stream.PassThrough({ objectMode: true })
  const join = new JoinAsRawEvent(stackTrace, traceEvent)

  async.series([
    function awaitTraceEvent (done) {
      t.equal(join.read(), null)
      join.once('readable', function () {
        t.strictSame(
          join.read().toJSON(),
          { type: 'traceEvent', asyncId: 1, info: traceEventData[0].toJSON() }
        )
        done(null)
      })
      traceEvent.write(traceEventData[0])
    },

    function awaitStackTrace (done) {
      t.equal(join.read(), null)
      join.once('readable', function () {
        t.strictSame(
          join.read().toJSON(),
          { type: 'stackTrace', asyncId: 1, info: stackTraceData[0].toJSON() }
        )
        done(null)
      })
      stackTrace.write(stackTraceData[0])
    },

    function awaitTraceEvent (done) {
      t.equal(join.read(), null)
      join.once('readable', function () {
        t.strictSame(
          join.read().toJSON(),
          { type: 'traceEvent', asyncId: 1, info: traceEventData[1].toJSON() }
        )
        done(null)
      })
      traceEvent.write(traceEventData[1])
    }
  ], function (err) {
    if (err) return t.error(err)
    t.end()
  })
})

test('Raw Event - end switches stream', function (t) {
  const stackTraceData = [
    new StackTrace({ asyncId: 1, frames: [] })
  ]

  const stackTrace = new stream.PassThrough({ objectMode: true })
  const traceEvent = new stream.PassThrough({ objectMode: true })
  const join = new JoinAsRawEvent(stackTrace, traceEvent)

  stackTrace.write(stackTraceData[0])
  t.equal(join.read(), null)
  join.once('readable', function () {
    t.strictSame(
      join.read().toJSON(),
      { type: 'stackTrace', asyncId: 1, info: stackTraceData[0].toJSON() }
    )
    t.end()
  })
  traceEvent.end()
})

test('Raw Event - fast end event', function (t) {
  const stackTrace = new stream.PassThrough({ objectMode: true })
  const traceEvent = new stream.PassThrough({ objectMode: true })
  const join = new JoinAsRawEvent(stackTrace, traceEvent)

  stackTrace.end()
  stackTrace.read() // force the end event to emit
  traceEvent.end()
  traceEvent.read() // force the end event to emit

  join.once('end', function () {
    t.end()
  })
  setImmediate(() => join.read())
})

test('Raw Event - truncates when low on memory', function (t) {
  let stackAsyncId = 1
  let traceAsyncId = 1
  let ticks = 0

  const datas = []

  const stackTrace = new stream.Readable({
    objectMode: true,
    read () {
      this.push(new StackTrace({ asyncId: stackAsyncId++, frames: [] }))
    }
  })

  const traceEvent = new stream.Readable({
    objectMode: true,
    read () {
      this.push(new TraceEvent({
        asyncId: traceAsyncId++,
        timestamp: ticks++,
        event: 'init',
        type: 'custom',
        triggerAsyncId: 0,
        executionAsyncId: 0
      }))
    }
  })

  const join = new JoinAsRawEvent(stackTrace, traceEvent)

  join.on('data', function (data) {
    // keep the data around similar to the analysis to trigger
    // high mem usage
    datas.push(data)
  })
  join.on('truncate', function () {
    t.end()
  })
})
