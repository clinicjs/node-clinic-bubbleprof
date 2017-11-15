'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const CombineAsSourceNodes = require('../analysis/combine-as-source-nodes.js')

test('join raw events order', function (t) {
  const joined = startpoint([
    {
      type: 'traceEvents',
      info: {
        event: 'init',
        type: 'HAS_STACK',
        asyncId: 1,
        triggerAsyncId: 0,
        timestamp: 1
      }
    },
    {
      type: 'stackTrace',
      info: {
        asyncId: 1,
        frames: []
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'before',
        asyncId: 1,
        timestamp: 2
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'after',
        asyncId: 1,
        timestamp: 3
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'destroy',
        asyncId: 1,
        timestamp: 4
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'init',
        type: 'NO_STACK',
        asyncId: 2,
        triggerAsyncId: 1,
        timestamp: 5
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'destroy',
        asyncId: 2,
        timestamp: 6
      }
    },
    {
      type: 'traceEvents',
      info: {
        event: 'init',
        type: 'NO_DESTROY',
        asyncId: 3,
        triggerAsyncId: 1,
        timestamp: 7
      }
    }
  ], { objectMode: true })

  joined
    .pipe(new CombineAsSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      const sourceNodes = new Map(data.map((node) => [node.asyncId, node]))
      t.strictEqual(data.length, 3)
      t.strictEqual(sourceNodes.size, 3)

      t.strictDeepEqual(Object.assign({}, sourceNodes.get(1)), {
        asyncId: 1,
        triggerAsyncId: 0,
        type: 'HAS_STACK',
        frames: [],
        framesHash: '00000000000000000000000000000000',
        init: 1,
        before: [2],
        after: [3],
        destroy: 4
      })

      t.strictDeepEqual(Object.assign({}, sourceNodes.get(2)), {
        asyncId: 2,
        triggerAsyncId: 1,
        type: 'NO_STACK',
        frames: null,
        framesHash: null,
        init: 5,
        before: [],
        after: [],
        destroy: 6
      })

      t.strictDeepEqual(Object.assign({}, sourceNodes.get(3)), {
        asyncId: 3,
        triggerAsyncId: 1,
        type: 'NO_DESTROY',
        frames: null,
        framesHash: null,
        init: 7,
        before: [],
        after: [],
        destroy: null
      })

      t.end()
    }))
})
