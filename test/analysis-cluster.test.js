'use strict'

const test = require('tap').test
const util = require('util')
const ClusterNode = require('../analysis/cluster/cluster-node.js')
const { FakeClusterNode, FakeBarrierNode } = require('./analysis-util')

test('Cluster Node - cluster.inspect', function (t) {
  const clusterNode = new FakeClusterNode({
    clusterId: 2,
    parentClusterId: 1,
    children: [3, 4],
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3],
      type: 'CUSTOM_A',
      frames: [{
        functionName: 'functionA',
        isToplevel: true,
        fileName: 'fileName.js',
        lineNumber: 10
      }, {
        functionName: 'functionB',
        isToplevel: true,
        fileName: 'fileName.js',
        lineNumber: 20
      }]
    }, {
      aggregateId: 3,
      parentAggregateId: 2,
      children: [4, 5],
      type: 'CUSTOM_B',
      frames: [{
        functionName: 'functionA',
        isToplevel: true,
        fileName: 'fileName.js',
        lineNumber: 10
      }, {
        functionName: 'functionB',
        isToplevel: true,
        fileName: 'fileName.js',
        lineNumber: 20
      }]
    }]
  })

  t.equal(
    util.inspect(clusterNode, { depth: null }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:null, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM_A, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>,\n' +
    '        <AggregateNode type:CUSTOM_B, mark:<Mark null>, aggregateId:3,' +
                          ' parentAggregateId:2, sources.length:1,' +
                          ' children:[4, 5], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(clusterNode, { depth: 3 }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:null, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM_A, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>,\n' +
    '        <AggregateNode type:CUSTOM_B, mark:<Mark null>, aggregateId:3,' +
                          ' parentAggregateId:2, sources.length:1,' +
                          ' children:[4, 5], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(clusterNode, { depth: 2 }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:null, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM_A, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3], frames:<Frames [<Frame>, <Frame>]>>,\n' +
    '        <AggregateNode type:CUSTOM_B, mark:<Mark null>, aggregateId:3,' +
                          ' parentAggregateId:2, sources.length:1,' +
                          ' children:[4, 5], frames:<Frames [<Frame>, <Frame>]>>]>'
  )

  t.equal(
    util.inspect(clusterNode, { depth: 1 }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:null, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM_A, mark:<Mark>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3], frames:<Frames>>,\n' +
    '        <AggregateNode type:CUSTOM_B, mark:<Mark>, aggregateId:3,' +
                          ' parentAggregateId:2, sources.length:1,' +
                          ' children:[4, 5], frames:<Frames>>]>'
  )

  t.equal(
    util.inspect(clusterNode, { depth: 0 }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:null, children:[3, 4], nodes:[' +
      '<AggregateNode>, <AggregateNode>]>'
  )

  t.equal(
    util.inspect(clusterNode, { depth: -1 }),
    '<ClusterNode>'
  )

  t.end()
})

test('Cluster Node - cluster.toJSON', function (t) {
  const clusterNode = new FakeClusterNode({
    clusterId: 2,
    parentClusterId: 1,
    children: [3, 4],
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3],
      type: 'CUSTOM',
      frames: []
    }]
  })

  t.strictSame(clusterNode.toJSON(), {
    clusterId: 2,
    parentClusterId: 1,
    name: null,
    children: [3, 4],
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3],
      type: 'CUSTOM',
      mark: [null, null, null],
      name: null,
      frames: [],
      sources: [clusterNode.nodes[0].sources[0].toJSON({ short: true })]
    }]
  })

  t.end()
})

test('Cluster Node - cluster.makeRoot', function (t) {
  const clusterNode = new ClusterNode(1, 0)
  clusterNode.makeRoot()
  t.equal(clusterNode.isRoot, true)
  t.end()
})

test('Cluster Node - cluster.addChild', function (t) {
  const clusterNode = new ClusterNode(2, 1)
  t.strictSame(clusterNode.children, [])
  clusterNode.addChild(3)
  t.strictSame(clusterNode.children, [3])
  clusterNode.addChild(5)
  t.strictSame(clusterNode.children, [3, 5])
  t.end()
})

test('Cluster Node - cluster.insertBarrierNode', function (t) {
  const barrierNodeCombined = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [4],
    isWrapper: false,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM_A',
      frames: []
    }, {
      aggregateId: 3,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'CUSTOM_B',
      frames: []
    }]
  })

  const barrierNodeWrapper = new FakeBarrierNode({
    barrierId: 6,
    parentBarrierId: 2,
    children: [8],
    isWrapper: true,
    nodes: [{
      aggregateId: 6,
      parentAggregateId: 3,
      children: [8],
      type: 'CUSTOM',
      frames: []
    }]
  })

  const clusterNodeForward = new ClusterNode(2, 1)
  clusterNodeForward.insertBarrierNode(barrierNodeCombined)
  clusterNodeForward.insertBarrierNode(barrierNodeWrapper)
  clusterNodeForward.sort()
  t.strictSame(
    clusterNodeForward.nodes.map((aggregateNode) => aggregateNode.aggregateId),
    [2, 3, 6]
  )

  const clusterNodeBackward = new ClusterNode(2, 1)
  clusterNodeBackward.insertBarrierNode(barrierNodeWrapper)
  clusterNodeBackward.insertBarrierNode(barrierNodeCombined)
  clusterNodeBackward.sort()
  t.strictSame(
    clusterNodeBackward.nodes.map((aggregateNode) => aggregateNode.aggregateId),
    [2, 3, 6]
  )

  t.end()
})

test('Cluster Node - name from barrier node', function (t) {
  const barrierNodeCombined = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [4],
    isWrapper: false,
    name: 'barrier-combined',
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM_A',
      frames: []
    }, {
      aggregateId: 3,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'CUSTOM_B',
      frames: []
    }]
  })

  const barrierNodeWrapper = new FakeBarrierNode({
    barrierId: 6,
    parentBarrierId: 2,
    children: [8],
    isWrapper: true,
    name: 'barrier-wrapper',
    nodes: [{
      aggregateId: 6,
      parentAggregateId: 3,
      children: [8],
      type: 'CUSTOM',
      frames: []
    }]
  })

  const clusterNodeForward = new ClusterNode(2, 1)
  clusterNodeForward.insertBarrierNode(barrierNodeCombined)
  clusterNodeForward.insertBarrierNode(barrierNodeWrapper)
  t.equal(clusterNodeForward.name, 'barrier-combined')

  const clusterNodeBackward = new ClusterNode(2, 1)
  clusterNodeBackward.insertBarrierNode(barrierNodeWrapper)
  clusterNodeBackward.insertBarrierNode(barrierNodeCombined)
  t.equal(clusterNodeForward.name, 'barrier-combined')

  t.equal(
    util.inspect(clusterNodeForward, { depth: 0 }),
    '<ClusterNode clusterId:2, parentClusterId:1, name:barrier-combined, children:[], nodes:[' +
      '<AggregateNode>, <AggregateNode>, <AggregateNode>]>'
  )

  t.end()
})
