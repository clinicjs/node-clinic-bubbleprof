'use strict'

const test = require('tap').test
const util = require('util')
const crypto = require('crypto')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const RawEvent = require('../analysis/raw-event/raw-event.js')
const SourceNode = require('../analysis/source/source-node.js')
const { FakeSourceNode } = require('./analysis-util')

test('Source Node - sourceNode.inspect', function (t) {
  const sourceNode = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  t.equal(
    util.inspect(sourceNode),
    '<SourceNode type:CUSTOM, asyncId:2, parentAsyncId:1,' +
    ' triggerAsyncId:1, executionAsyncId:0, identifier:null>'
  )
  sourceNode.setIdentifier('string will be the id')
  t.equal(
    util.inspect(sourceNode),
    '<SourceNode type:CUSTOM, asyncId:2, parentAsyncId:1,' +
    ' triggerAsyncId:1, executionAsyncId:0, identifier:66e4917ca59cec24>'
  )
  t.end()
})

test('Source Node - sourceNode.toJSON', function (t) {
  const sourceNode = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  const sourceNodeNoData = new FakeSourceNode({
    asyncId: 2
  })

  t.strictSame(sourceNodeNoData.toJSON(), {
    asyncId: 2,
    frames: null,
    type: null,
    identifier: null,
    parentAsyncId: null,
    triggerAsyncId: null,
    executionAsyncId: null,
    init: null,
    before: [],
    after: [],
    destroy: null
  })

  t.strictSame(sourceNodeNoData.toJSON({ short: true }), {
    asyncId: 2,
    parentAsyncId: null,
    triggerAsyncId: null,
    executionAsyncId: null,
    init: null,
    before: [],
    after: [],
    destroy: null
  })

  t.strictSame(sourceNode.toJSON(), {
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    identifier: null,
    parentAsyncId: 1,
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  t.strictSame(sourceNode.toJSON({ short: true }), {
    asyncId: 2,
    parentAsyncId: 1,
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  t.end()
})

test('Source Node - sourceNode.makeRoot', function (t) {
  const sourceNodeRoot = new SourceNode(0)
  sourceNodeRoot.makeRoot()

  t.strictSame(sourceNodeRoot.toJSON(), {
    asyncId: 0,
    frames: [],
    type: null,
    identifier: null,
    parentAsyncId: null,
    triggerAsyncId: null,
    executionAsyncId: null,
    init: null,
    before: [],
    after: [],
    destroy: null
  })

  t.end()
})

test('Source Node - sourceNode.setIdentifier', function (t) {
  const sourceNode = new FakeSourceNode({ asyncId: 2 })

  t.equal(
    sourceNode.hash(),
    null
  )
  t.equal(
    sourceNode.toJSON().identifier,
    null
  )

  sourceNode.setIdentifier('string will be the id')

  t.equal(
    sourceNode.toJSON().identifier,
    'string will be the id'
  )
  t.equal(
    sourceNode.hash(),
    crypto.createHash('sha256').update('string will be the id').digest('hex')
  )

  t.end()
})

test('Source Node - sourceNode.addRawEvent', function (t) {
  const stackTraceObject = new StackTrace({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ]
  })
  const traceEventObject = new TraceEvent({
    asyncId: 2,
    timestamp: 1,
    event: 'init',
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0
  })

  const sourceNodeWithStackTrace = new SourceNode(2)
  sourceNodeWithStackTrace.addRawEvent(
    RawEvent.wrapStackTrace(stackTraceObject)
  )
  const sourceNodeWithStackTraceExpected = new SourceNode(2)
  sourceNodeWithStackTraceExpected.addStackTrace(stackTraceObject)
  t.strictSame(
    sourceNodeWithStackTrace,
    sourceNodeWithStackTraceExpected
  )

  const sourceNodeWithTraceEvent = new SourceNode(2)
  sourceNodeWithTraceEvent.addRawEvent(
    RawEvent.wrapTraceEvent(traceEventObject)
  )
  const sourceNodeWithTraceEventExpected = new SourceNode(2)
  sourceNodeWithTraceEventExpected.addTraceEvent(traceEventObject)
  t.strictSame(
    sourceNodeWithTraceEvent,
    sourceNodeWithTraceEventExpected
  )

  const sourceNodeNotRawEvent = new SourceNode(2)
  t.throws(
    () => sourceNodeNotRawEvent.addRawEvent({
      type: 'stackTrace'
    }),
    new TypeError('addRawEvent input must be a RawEvent instance')
  )

  const sourceNodeBadRawEventType = new SourceNode(2)
  const badRawEvent = new RawEvent('badType', 2, {})
  t.throws(
    () => sourceNodeBadRawEventType.addRawEvent(badRawEvent),
    new Error('unknown RawEvent type value: badType')
  )

  t.end()
})

test('Source Node - sourceNode.addStackTrace', function (t) {
  const stackTraceObject = new StackTrace({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ]
  })

  const sourceNode = new SourceNode(2)
  sourceNode.addStackTrace(stackTraceObject)
  t.equal(sourceNode.frames, stackTraceObject.frames)

  const sourceNodeNodeStackTrace = new SourceNode(2)
  t.throws(
    () => sourceNodeNodeStackTrace.addStackTrace({ frames: [] }),
    new TypeError('addStackTrace input must be a StackTrace instance')
  )

  t.end()
})

test('Source Node - sourceNode.addTraceEvent', function (t) {
  const traceEventInitObject = new TraceEvent({
    asyncId: 2,
    timestamp: 1,
    event: 'init',
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0
  })

  const traceEventBeforeObject = new TraceEvent({
    asyncId: 2,
    timestamp: 2,
    event: 'before',
    type: 'CUSTOM',
    triggerAsyncId: null,
    executionAsyncId: null
  })

  const traceEventAfterObject = new TraceEvent({
    asyncId: 2,
    timestamp: 3,
    event: 'after',
    type: 'CUSTOM',
    triggerAsyncId: null,
    executionAsyncId: null
  })

  const traceEventDestroyObject = new TraceEvent({
    asyncId: 2,
    timestamp: 4,
    event: 'destroy',
    type: 'CUSTOM',
    triggerAsyncId: null,
    executionAsyncId: null
  })

  const traceEventBadObject = new TraceEvent({
    asyncId: 2,
    timestamp: 4,
    event: 'bad',
    type: 'CUSTOM',
    triggerAsyncId: null,
    executionAsyncId: null
  })

  const sourceNode = new SourceNode(2)
  sourceNode.addTraceEvent(traceEventInitObject)
  sourceNode.addTraceEvent(traceEventBeforeObject)
  sourceNode.addTraceEvent(traceEventAfterObject)
  sourceNode.addTraceEvent(traceEventDestroyObject)

  t.strictSame(sourceNode.toJSON(), {
    asyncId: 2,
    frames: null,
    type: 'CUSTOM',
    identifier: null,
    parentAsyncId: 1,
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2],
    after: [3],
    destroy: 4
  })

  const sourceNodeNotTraceEvent = new SourceNode(2)
  t.throws(
    () => sourceNodeNotTraceEvent.addTraceEvent({ type: 'CUSTOM' }),
    new TypeError('addTraceEvent input must be a TraceEvent instance')
  )

  const sourceNodeBadTraceEvent = new SourceNode(2)
  t.throws(
    () => sourceNodeBadTraceEvent.addTraceEvent(traceEventBadObject),
    new Error('unknown TraceEvent type value: bad')
  )

  t.end()
})

test('Source Node - sourceNode.isComplete', function (t) {
  const sourceNodeNoFrames = new FakeSourceNode({
    asyncId: 2,
    frames: null,
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  const sourceNodeNoInit = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: null,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  const sourceNodeNoDestroy = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: null
  })

  const sourceNodeUnmatchingBeforeAndAfter = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3],
    destroy: 6
  })

  const sourceNodeComplete = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  t.equal(sourceNodeNoFrames.isComplete(), false)
  t.equal(sourceNodeNoInit.isComplete(), false)
  t.equal(sourceNodeNoDestroy.isComplete(), false)
  t.equal(sourceNodeUnmatchingBeforeAndAfter.isComplete(), false)
  t.equal(sourceNodeComplete.isComplete(), true)
  t.end()
})

test('Source Node - sourceNode.hasStackTrace', function (t) {
  const sourceNodeNoFrames = new FakeSourceNode({
    asyncId: 2,
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })

  const sourceNodeWithFrames = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js' }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1
  })

  t.equal(sourceNodeNoFrames.hasStackTrace(), false)
  t.equal(sourceNodeWithFrames.hasStackTrace(), true)
  t.end()
})
