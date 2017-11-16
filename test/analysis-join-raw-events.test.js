'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const JoinRawEvents = require('../analysis/join-raw-events.js')

test('join raw events order', function (t) {
  const stackTrace = startpoint([
    { asyncId: 1, timestamp: 1 },
    { asyncId: 2, timestamp: 3 },
    { asyncId: 3, timestamp: 5 }
  ], { objectMode: true })

  const traceEvents = startpoint([
    { asyncId: 1, timestamp: 1 },
    { asyncId: 1, timestamp: 2 },
    { asyncId: 2, timestamp: 3 },
    { asyncId: 1, timestamp: 4 },
    { asyncId: 3, timestamp: 5 },
    { asyncId: 2, timestamp: 6 },
    { asyncId: 1, timestamp: 7 },
    { asyncId: 3, timestamp: 8 }
  ], { objectMode: true })

  new JoinRawEvents(stackTrace, traceEvents)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data, [
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 1 } },
        { type: 'stackTrace', info: { asyncId: 1, timestamp: 1 } },
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 2 } },
        { type: 'traceEvents', info: { asyncId: 2, timestamp: 3 } },
        { type: 'stackTrace', info: { asyncId: 2, timestamp: 3 } },
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 4 } },
        { type: 'traceEvents', info: { asyncId: 3, timestamp: 5 } },
        { type: 'stackTrace', info: { asyncId: 3, timestamp: 5 } },
        { type: 'traceEvents', info: { asyncId: 2, timestamp: 6 } },
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 7 } },
        { type: 'traceEvents', info: { asyncId: 3, timestamp: 8 } }
      ])
      t.end()
    }))
})

test('join raw events - earily stackTrace end', function (t) {
  const stackTrace = startpoint([
    { asyncId: 1, timestamp: 1 }
  ], { objectMode: true })

  const traceEvents = startpoint([
    { asyncId: 1, timestamp: 1 },
    { asyncId: 2, timestamp: 2 },
    { asyncId: 3, timestamp: 3 }
  ], { objectMode: true })

  new JoinRawEvents(stackTrace, traceEvents)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data, [
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 1 } },
        { type: 'stackTrace', info: { asyncId: 1, timestamp: 1 } },
        { type: 'traceEvents', info: { asyncId: 2, timestamp: 2 } },
        { type: 'traceEvents', info: { asyncId: 3, timestamp: 3 } }
      ])
      t.end()
    }))
})

test('join raw events - earily traceEvents end', function (t) {
  const stackTrace = startpoint([
    { asyncId: 1, timestamp: 1 },
    { asyncId: 2, timestamp: 2 },
    { asyncId: 3, timestamp: 3 }
  ], { objectMode: true })

  const traceEvents = startpoint([
    { asyncId: 1, timestamp: 1 },
    { asyncId: 1, timestamp: 2 }
  ], { objectMode: true })

  new JoinRawEvents(stackTrace, traceEvents)
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(data, [
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 1 } },
        { type: 'stackTrace', info: { asyncId: 1, timestamp: 1 } },
        { type: 'traceEvents', info: { asyncId: 1, timestamp: 2 } },
        { type: 'stackTrace', info: { asyncId: 2, timestamp: 2 } },
        { type: 'stackTrace', info: { asyncId: 3, timestamp: 3 } }
      ])
      t.end()
    }))
})
