'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const FilterSourceNodes = require('../analysis/source/filter-source-nodes.js')
const StackTrace = require('../analysis/raw-event/stack-trace.js')
const TraceEvent = require('../analysis/raw-event/trace-event.js')
const SourceNode = require('../analysis/source/source-node.js')

test('filter source nodes', function (t) {
  const nodeNotFiltered = new SourceNode(1)
  nodeNotFiltered.addStackTrace(new StackTrace({
    asyncId: 1,
    frames: []
  }))
  nodeNotFiltered.addTraceEvent(new TraceEvent({
    event: 'init',
    type: 'NOT_FILTERED',
    asyncId: 1,
    triggerAsyncId: 0,
    timestamp: 1
  }))
  nodeNotFiltered.addTraceEvent(new TraceEvent({
    event: 'destroy',
    asyncId: 1,
    timestamp: 2
  }))

  const nodeNoStack = new SourceNode(2)
  nodeNoStack.addTraceEvent(new TraceEvent({
    event: 'init',
    type: 'NOT_FILTERED',
    asyncId: 2,
    triggerAsyncId: 0,
    timestamp: 1
  }))
  nodeNoStack.addTraceEvent(new TraceEvent({
    event: 'destroy',
    asyncId: 2,
    timestamp: 2
  }))

  const nodeTimer = new SourceNode(3)
  nodeTimer.addStackTrace(new StackTrace({
    asyncId: 3,
    frames: []
  }))
  nodeTimer.addTraceEvent(new TraceEvent({
    event: 'init',
    type: 'TIMERWRAP',
    asyncId: 3,
    triggerAsyncId: 0,
    timestamp: 1
  }))
  nodeTimer.addTraceEvent(new TraceEvent({
    event: 'destroy',
    asyncId: 3,
    timestamp: 2
  }))

  startpoint([nodeNotFiltered, nodeNoStack, nodeTimer], { objectMode: true })
    .pipe(new FilterSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, nodes) {
      if (err) return t.ifError(err)

      t.strictEqual(nodes.length, 1)
      t.strictEqual(nodes[0].asyncId, 1)
      t.end()
    }))
})
