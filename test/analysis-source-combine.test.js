'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const RawEvent = require('../analysis/raw-event/raw-event.js')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const CombineAsSourceNodes = require('../analysis/source/combine-as-source-nodes.js')

test('Source Node - combine', function (t) {
  const joined = startpoint([
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'init',
      type: 'HAS_STACK',
      asyncId: 1,
      triggerAsyncId: 0,
      executionAsyncId: 0,
      timestamp: 1
    })),
    RawEvent.wrapStackTrace(new StackTrace({
      asyncId: 1,
      frames: []
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'before',
      asyncId: 1,
      timestamp: 2
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'after',
      asyncId: 1,
      timestamp: 3
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'destroy',
      asyncId: 1,
      timestamp: 4
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'init',
      type: 'NO_STACK',
      asyncId: 2,
      triggerAsyncId: 1,
      executionAsyncId: 1,
      timestamp: 5
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'destroy',
      asyncId: 2,
      timestamp: 6
    })),
    RawEvent.wrapTraceEvent(new TraceEvent({
      event: 'init',
      type: 'NO_DESTROY',
      asyncId: 3,
      triggerAsyncId: 1,
      executionAsyncId: 1,
      timestamp: 7
    }))
  ], { objectMode: true })

  joined
    .pipe(new CombineAsSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.error(err)

      const sourceNodes = new Map(data.map((node) => [node.asyncId, node]))
      t.equal(data.length, 3)
      t.equal(sourceNodes.size, 3)

      t.strictSame(sourceNodes.get(1).toJSON(), {
        asyncId: 1,
        triggerAsyncId: 0,
        executionAsyncId: 0,
        parentAsyncId: 0,
        type: 'HAS_STACK',
        frames: [],
        identifier: null,
        init: 1,
        before: [2],
        after: [3],
        destroy: 4
      })

      t.strictSame(sourceNodes.get(2).toJSON(), {
        asyncId: 2,
        triggerAsyncId: 1,
        executionAsyncId: 1,
        parentAsyncId: 1,
        type: 'NO_STACK',
        frames: null,
        identifier: null,
        init: 5,
        before: [],
        after: [],
        destroy: 6
      })

      t.strictSame(sourceNodes.get(3).toJSON(), {
        asyncId: 3,
        triggerAsyncId: 1,
        executionAsyncId: 1,
        parentAsyncId: 1,
        type: 'NO_DESTROY',
        frames: null,
        identifier: null,
        init: 7,
        before: [],
        after: [],
        destroy: null
      })

      t.end()
    }))
})
