'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const FilterSourceNodes = require('../analysis/filter-source-nodes.js')
const SourceNode = require('../analysis/source-node.js')

test('filter source nodes', function (t) {
  const nodeNotFiltered = new SourceNode(1)
  nodeNotFiltered.addStackTrace({
    asyncId: 1,
    frames: []
  })
  nodeNotFiltered.addTraceEvent({
    event: 'init',
    type: 'NOT_FILTERED',
    asyncId: 1,
    triggerAsyncId: 0,
    timestamp: 1
  })
  nodeNotFiltered.addTraceEvent({
    event: 'destroy',
    asyncId: 1,
    timestamp: 2
  })

  const nodeNoStack = new SourceNode(2)
  nodeNoStack.addTraceEvent({
    event: 'init',
    type: 'NOT_FILTERED',
    asyncId: 2,
    triggerAsyncId: 0,
    timestamp: 1
  })
  nodeNoStack.addTraceEvent({
    event: 'destroy',
    asyncId: 2,
    timestamp: 2
  })

  const nodeTimer = new SourceNode(3)
  nodeTimer.addStackTrace({
    asyncId: 3,
    frames: []
  })
  nodeTimer.addTraceEvent({
    event: 'init',
    type: 'TIMERWRAP',
    asyncId: 3,
    triggerAsyncId: 0,
    timestamp: 1
  })
  nodeTimer.addTraceEvent({
    event: 'destroy',
    asyncId: 3,
    timestamp: 2
  })

  startpoint([nodeNotFiltered, nodeNoStack, nodeTimer], { objectMode: true })
    .pipe(new FilterSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, nodes) {
      if (err) return t.ifError(err)

      t.strictEqual(nodes.length, 1)
      t.strictEqual(nodes[0].asyncId, 1)
      t.end()
    }))
});
