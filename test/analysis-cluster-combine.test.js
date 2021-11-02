'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const CombineAsClusterNodes = require('../analysis/cluster/combine-as-cluster-nodes.js')
const { FakeBarrierNode } = require('./analysis-util')

function createTreeStructure () {
  // root - 1
  //   parent (user) - 2
  //   -- child (same origin) - 3
  //   |  child (same origin) - 4
  //        grandchild (user) - 6
  //           exit scope (external) - 7
  //   -- child (wrapper barrier) - 5
  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2],
      isRoot: true
    }]
  })

  const barrierNodeParentUser = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 5],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4, 5],
      type: 'USER_PARENT',
      frames: []
    }]
  })

  const barrierNodeChildCombined = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [6],
    isWrapper: false,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 2,
      children: [],
      type: 'USER_COMBINED',
      frames: []
    }, {
      aggregateId: 4,
      parentAggregateId: 2,
      children: [6],
      type: 'USER_COMBINED',
      frames: []
    }]
  })

  const barrierNodeParentDeepUserChild = new FakeBarrierNode({
    barrierId: 6,
    parentBarrierId: 3,
    children: [7],
    isWrapper: true,
    nodes: [{
      aggregateId: 6,
      parentAggregateId: 4,
      children: [7],
      type: 'USER_DEEPCHILD',
      frames: []
    }]
  })

  const barrierNodeParentDeepExternalChild = new FakeBarrierNode({
    barrierId: 7,
    parentBarrierId: 6,
    children: [],
    isWrapper: false,
    nodes: [{
      aggregateId: 7,
      parentAggregateId: 6,
      children: [],
      type: 'EXTERNAL_DEEPCHILD',
      frames: []
    }]
  })

  const barrierNodeChildStandaloneBarrier = new FakeBarrierNode({
    barrierId: 5,
    parentBarrierId: 2,
    children: [],
    isWrapper: false,
    nodes: [{
      aggregateId: 5,
      parentAggregateId: 2,
      children: [],
      type: 'USER_COMBINED',
      frames: []
    }]
  })

  return [
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeChildCombined, barrierNodeChildStandaloneBarrier,
    barrierNodeParentDeepUserChild,
    barrierNodeParentDeepExternalChild
  ]
}

function extractState (clusterNode) {
  return {
    clusterId: clusterNode.clusterId,
    parentClusterId: clusterNode.parentClusterId,
    children: clusterNode.children,
    nodes: clusterNode.nodes.map((aggregateNode) => aggregateNode.aggregateId)
  }
}

function checkTreeStructure (t, clusterNodes) {
  // root - 1
  // . parent (user) - 2
  //   -- child (same origin) - 3
  //   |  child (same origin) - 4
  //   ..... grandchild (user) - 6
  //         -- exit scope (external) - 7
  //   -- child (wrapper barrier) - 5

  const [
    clusterNodeRoot,
    clusterNodeSameOrigin,
    clusterNodeStandalone,
    clusterNodeExitSameOrigin
  ] = clusterNodes

  t.strictSame(extractState(clusterNodeRoot), {
    clusterId: 1,
    parentClusterId: 0,
    children: [2, 3],
    nodes: [1, 2]
  })

  t.strictSame(extractState(clusterNodeSameOrigin), {
    clusterId: 2,
    parentClusterId: 1,
    children: [4],
    nodes: [3, 4, 6]
  })

  t.strictSame(extractState(clusterNodeExitSameOrigin), {
    clusterId: 4,
    parentClusterId: 2,
    children: [],
    nodes: [7]
  })

  t.strictSame(extractState(clusterNodeStandalone), {
    clusterId: 3,
    parentClusterId: 1,
    children: [],
    nodes: [5]
  })
}

test('Cluster Node - combine', function (t) {
  const barrierNodesInput = createTreeStructure()

  startpoint(barrierNodesInput, { objectMode: true })
    .pipe(new CombineAsClusterNodes())
    .pipe(endpoint({ objectMode: true }, function (err, clusterNodeOutput) {
      if (err) return t.error(err)

      checkTreeStructure(t, clusterNodeOutput)
      t.end()
    }))
})
