'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const { FakeSystemInfo, FakeAggregateNode } = require('./analysis-util')

const WrapAsBarrierNodes = require('../analysis/barrier/wrap-as-barrier-nodes.js')
const MakeSynchronousBarrierNodes = require('../analysis/barrier/make-synchronous-barrier-nodes.js')

function createTreeStructure () {
  const data = [
    new FakeAggregateNode({
      aggregateId: 1,
      parentAggregateId: 0,
      children: [10, 11],
      isRoot: true,
      frames: []
    }),

    // The source in the users code is the same, thus these two AggregateNode's
    // will genereate a barrierNode.
    new FakeAggregateNode({
      aggregateId: 10,
      parentAggregateId: 1,
      children: [12],
      type: 'Immediate',
      frames:
      [{
        functionName: 'recursiveFunction',
        isToplevel: true,
        fileName: '/servers/bug.js',
        lineNumber: 9
      },
      {
        functionName: 'maybeCache',
        typeName: 'Router',
        fileName: '/node_modules/external-server/router.js',
        lineNumber: 436
      }]
    }),

    new FakeAggregateNode({
      aggregateId: 11,
      parentAggregateId: 1,
      children: [13],
      type: 'Immediate',
      frames:
      [{
        functionName: 'recursiveFunction',
        isToplevel: true,
        fileName: '/servers/bug.js',
        lineNumber: 9
      },
      {
        functionName: 'maybeCache',
        typeName: 'Router',
        fileName: '/node_modules/external-server/router.js',
        lineNumber: 551
      }]
    }),

    // These two AggregateNode both have the "external-server" barrierNode
    // as their parrent and they have the same source in the users code.
    // However, they should not be joined as that would cause the hypothetical
    // BarrierNode to have two different AggregateNode's as the parent, which
    // should never be possible.
    new FakeAggregateNode({
      aggregateId: 12,
      parentAggregateId: 10,
      children: [],
      type: 'Immediate',
      frames:
      [{
        functionName: 'recursiveFunction',
        isToplevel: true,
        fileName: '/servers/bug.js',
        lineNumber: 9
      }]
    }),

    new FakeAggregateNode({
      aggregateId: 13,
      parentAggregateId: 11,
      children: [],
      type: 'Immediate',
      frames:
      [{
        functionName: 'recursiveFunction',
        isToplevel: true,
        fileName: '/servers/bug.js',
        lineNumber: 9
      }]
    })
  ]

  return startpoint(data, { objectMode: true })
}

function getBarrierNodeEssentials (barrierNode) {
  return {
    barrierId: barrierNode.barrierId,
    children: barrierNode.children,
    nodes: barrierNode.nodes.map((aggregateNode) => aggregateNode.aggregateId),
    isWrapper: barrierNode.isWrapper
  }
}

test('Barrier Node - make synchronous - BarrierNode parrent', function (t) {
  const systemInfo = new FakeSystemInfo('/servers')

  createTreeStructure()
    .pipe(new WrapAsBarrierNodes())
    .pipe(new MakeSynchronousBarrierNodes(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      t.error(err)

      const barrierNodes = new Map(
        data.map((barrierNode) => [barrierNode.barrierId, barrierNode])
      )

      t.strictSame(getBarrierNodeEssentials(barrierNodes.get(1)), {
        barrierId: 1,
        children: [10],
        nodes: [1],
        isWrapper: true
      })
      t.strictSame(getBarrierNodeEssentials(barrierNodes.get(10)), {
        barrierId: 10,
        children: [12, 13],
        nodes: [10, 11],
        isWrapper: false
      })
      t.strictSame(getBarrierNodeEssentials(barrierNodes.get(12)), {
        barrierId: 12,
        children: [],
        nodes: [12],
        isWrapper: true
      })
      t.strictSame(getBarrierNodeEssentials(barrierNodes.get(13)), {
        barrierId: 13,
        children: [],
        nodes: [13],
        isWrapper: true
      })
      t.end()
    }))
})
