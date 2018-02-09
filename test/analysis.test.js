'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const analysis = require('../analysis/index.js')
const { FakeSystemInfo, FakeSourceNode } = require('./analysis-util')
const BarrierNode = require('../analysis/barrier/barrier-node.js')
const ClusterNode = require('../analysis/cluster/cluster-node.js')
const AggregateNode = require('../analysis/aggregate/aggregate-node.js')

function createInputStream (frames) {
  const { frameUser, frameExternal, frameNodecore } = frames

  const stackTraceData = [
    { asyncId: 2, frames: [frameUser, frameNodecore] },
    { asyncId: 3, frames: [frameExternal, frameNodecore] }
  ]
  const traceEventData = [
    {
      asyncId: 2,
      timestamp: 1,
      event: 'init',
      type: 'NextTick',
      triggerAsyncId: 1,
      executionAsyncId: 1
    }, {
      asyncId: 2,
      timestamp: 2,
      event: 'before',
      type: 'NextTick',
      triggerAsyncId: null,
      executionAsyncId: null
    }, {
      asyncId: 3,
      timestamp: 3,
      event: 'init',
      type: 'NextTick',
      triggerAsyncId: 2,
      executionAsyncId: 2
    }, {
      asyncId: 2,
      timestamp: 4,
      event: 'after',
      type: 'NextTick',
      triggerAsyncId: null,
      executionAsyncId: null
    }, {
      asyncId: 3,
      timestamp: 5,
      event: 'destroy',
      type: 'NextTick',
      triggerAsyncId: null,
      executionAsyncId: null
    }, {
      asyncId: 2,
      timestamp: 7,
      event: 'destroy',
      type: 'NextTick',
      triggerAsyncId: null,
      executionAsyncId: null
    }
  ]

  const systemInfoParsed = new FakeSystemInfo('/')
  const systemInfoData = [{
    providers: systemInfoParsed.providers,
    pathSeperator: systemInfoParsed.pathSeperator,
    mainDirectory: systemInfoParsed.mainDirectory
  }]

  const systemInfo = startpoint(systemInfoData, { objectMode: true })
  const stackTrace = startpoint(stackTraceData, { objectMode: true })
  const traceEvent = startpoint(traceEventData, { objectMode: true })

  return { systemInfo, stackTrace, traceEvent }
}

function createExpectedStructure (frames) {
  const { frameUser, frameExternal, frameNodecore } = frames

  const aggregateNodeRoot = new AggregateNode(1, 0)
  aggregateNodeRoot.addChild(2)
  aggregateNodeRoot.makeRoot()

  const aggregateNodeUser = new AggregateNode(2, 1)
  aggregateNodeUser.addChild(3)
  aggregateNodeUser.mark.set(0, 'user')
  aggregateNodeUser.addSourceNode(new FakeSourceNode({
    asyncId: 2,
    type: 'NextTick',
    frames: [frameUser, frameNodecore],
    triggerAsyncId: 1,
    executionAsyncId: 1,
    init: 1,
    before: [2],
    after: [4],
    destroy: 7
  }))

  const aggregateNodeExternal = new AggregateNode(3, 2)
  aggregateNodeExternal.mark.set(0, 'external')
  aggregateNodeExternal.mark.set(1, 'external')
  aggregateNodeExternal.addSourceNode(new FakeSourceNode({
    asyncId: 3,
    type: 'NextTick',
    frames: [frameExternal, frameNodecore],
    triggerAsyncId: 2,
    executionAsyncId: 2,
    init: 3,
    before: [],
    after: [],
    destroy: 5
  }))

  const barrierNodeRoot = new BarrierNode(1, 0)
  barrierNodeRoot.initializeAsWrapper(
    aggregateNodeRoot,
    aggregateNodeRoot.children
  )

  const barrierNodeUser = new BarrierNode(2, 1)
  barrierNodeUser.initializeAsWrapper(
    aggregateNodeUser,
    aggregateNodeUser.children
  )

  const barrierNodeExternal = new BarrierNode(3, 2)
  barrierNodeExternal.initializeAsWrapper(
    aggregateNodeExternal,
    aggregateNodeExternal.children
  )
  barrierNodeExternal.makeBarrier()

  const clusterNodeRoot = new ClusterNode(1, 0)
  clusterNodeRoot.makeRoot()
  clusterNodeRoot.addChild(2)
  clusterNodeRoot.insertBarrierNode(barrierNodeRoot)
  clusterNodeRoot.insertBarrierNode(barrierNodeUser)
  clusterNodeRoot.name = ''

  const clusterNodeExternal = new ClusterNode(2, 1)
  clusterNodeExternal.insertBarrierNode(barrierNodeExternal)
  clusterNodeExternal.name = 'module.external'

  return { clusterNodeRoot, clusterNodeExternal }
}

test('Analysis - pipeline', function (t) {
  const frameUser = {
    functionName: 'userMain',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 10
  }
  const frameExternal = {
    functionName: 'external',
    isToplevel: true,
    fileName: '/node_modules/external/index.js',
    lineNumber: 10
  }
  const frameNodecore = {
    functionName: 'nodecore',
    isToplevel: true,
    fileName: 'internal/process.js',
    lineNumber: 10
  }

  const {
    systemInfo, stackTrace, traceEvent
  } = createInputStream({ frameUser, frameExternal, frameNodecore })

  const {
    clusterNodeRoot, clusterNodeExternal
  } = createExpectedStructure({ frameUser, frameExternal, frameNodecore })

  analysis(systemInfo, stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, output) {
      if (err) return t.ifError(err)

      t.strictDeepEqual(output[0].toJSON(), clusterNodeRoot.toJSON())
      t.strictDeepEqual(output[1].toJSON(), clusterNodeExternal.toJSON())

      t.end()
    }))
})
test('Analysis - pipeline with SystemInfo error', function (t) {
  const systemInfo = startpoint(new Error('error'), { objectMode: true })
  const stackTrace = startpoint([], { objectMode: true })
  const traceEvent = startpoint([], { objectMode: true })

  analysis(systemInfo, stackTrace, traceEvent)
    .pipe(endpoint({ objectMode: true }, function (err, output) {
      t.strictDeepEqual(err, new Error('error'))
      t.end()
    }))
})
