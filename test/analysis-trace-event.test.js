'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const WrapAsTraceEvent = require('../analysis/trace-event/wrap-as-trace-event.js')

test('Trace Event - stream wrap', function (t) {
  const input = [{
    asyncId: 1,
    event: 'init',
    type: 'custom',
    timestamp: 1,
    triggerAsyncId: 1,
    executionAsyncId: 0
  }]

  startpoint(input, { objectMode: true })
    .pipe(new WrapAsTraceEvent())
    .pipe(endpoint({ objectMode: true }, function (err, output) {
      if (err) return t.error(err)

      t.strictSame(
        output,
        input.map((data) => new TraceEvent(data))
      )

      t.end()
    }))
})

test('Trace Event - toJSON', function (t) {
  const input = {
    asyncId: 1,
    event: 'init',
    type: 'custom',
    timestamp: 1,
    triggerAsyncId: 1,
    executionAsyncId: 0
  }

  t.strictSame(new TraceEvent(input).toJSON(), input)
  t.end()
})
