'use strict'

const test = require('tap').test
const util = require('util')
const BarrierNode = require('../analysis/barrier/barrier-node.js')
const { FakeBarrierNode, FakeAggregateNode } = require('./analysis-util')

test('Barrier Node - barrier.inspect', function (t) {
  const barrierNodeWrapper = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM',
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

  const barrierNodeCombined = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4, 6, 7],
    isWrapper: false,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
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
      aggregateId: 5,
      parentAggregateId: 1,
      children: [6, 7],
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

  const barrierNodeNamed = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4],
    isWrapper: true,
    name: 'a-barrier-node',
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM',
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
    util.inspect(barrierNodeNamed, { depth: null }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:a-barrier-node, isWrapper:true, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3, 4], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(barrierNodeWrapper, { depth: null }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:null, isWrapper:true, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3, 4], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(barrierNodeWrapper, { depth: 3 }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:null, isWrapper:true, children:[3, 4], nodes:[\n' +
    '        <AggregateNode type:CUSTOM, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3, 4], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(barrierNodeWrapper, { depth: 0 }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:null, isWrapper:true, children:[3, 4], nodes:[<AggregateNode>]>'
  )

  t.equal(
    util.inspect(barrierNodeWrapper, { depth: -1 }),
    '<BarrierNode>'
  )

  t.equal(
    util.inspect(barrierNodeCombined, { depth: 3 }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:null, isWrapper:false, children:[3, 4, 6, 7], nodes:[\n' +
    '        <AggregateNode type:CUSTOM_A, mark:<Mark null>, aggregateId:2,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[3, 4], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>,\n' +
    '        <AggregateNode type:CUSTOM_B, mark:<Mark null>, aggregateId:5,' +
                          ' parentAggregateId:1, sources.length:1,' +
                          ' children:[6, 7], frames:<Frames [\n' +
    '                 <Frame functionA fileName.js:10>,\n' +
    '                 <Frame functionB fileName.js:20>]>>]>'
  )

  t.equal(
    util.inspect(barrierNodeCombined, { depth: 0 }),
    '<BarrierNode barrierId:2, parentBarrierId:1,' +
                ' name:null, isWrapper:false, children:[3, 4, 6, 7], nodes:[' +
             '<AggregateNode>, <AggregateNode>' +
    ']>'
  )

  t.end()
})

test('Barrier Node - barrier.toJSON', function (t) {
  const barrierNode = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM',
      mark: [null, null, null],
      frames: []
    }]
  })

  t.strictSame(barrierNode.toJSON(), {
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4],
    name: null,
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4],
      type: 'CUSTOM',
      mark: [null, null, null],
      name: null,
      frames: [],
      sources: [barrierNode.nodes[0].sources[0].toJSON({ short: true })]
    }]
  })

  t.end()
})

test('Barrier Node - barrier.updateParentBarrierId', function (t) {
  const barrierNode = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 2,
      children: [],
      type: 'CUSTOM',
      mark: [null, null, null],
      frames: []
    }]
  })
  t.equal(barrierNode.parentBarrierId, 2)
  barrierNode.updateParentBarrierId(1)
  t.equal(barrierNode.parentBarrierId, 1)
  t.end()
})

test('Barrier Node - barrier.setName', function (t) {
  const barrierNode = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: []
  })

  t.equal(barrierNode.name, null)
  barrierNode.setName('barrier-name')
  t.equal(barrierNode.name, 'barrier-name')
  barrierNode.setName('new-barrier-name')
  t.equal(barrierNode.name, 'new-barrier-name')
  t.end()
})

test('Barrier Node - barrier.updateChildren', function (t) {
  const barrierNode = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: []
  })
  t.strictSame(barrierNode.children, [])
  barrierNode.updateChildren([1, 5, 2])
  t.strictSame(barrierNode.children, [1, 2, 5])
  barrierNode.updateChildren([5, 1])
  t.strictSame(barrierNode.children, [1, 5])
  t.end()
})

test('Barrier Node - barrier.unwrapNode', function (t) {
  const barrierNodeWrapper = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      type: 'CUSTOM',
      frames: []
    }]
  })

  const barrierNodeNotWrapper = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [],
    isWrapper: false,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      type: 'CUSTOM',
      frames: []
    }]
  })

  t.equal(
    barrierNodeWrapper.unwrapNode(),
    barrierNodeWrapper.nodes[0]
  )
  t.throws(
    () => barrierNodeNotWrapper.unwrapNode(),
    new Error('trying to unwrap non-wrap barrierNode: 2')
  )
  t.end()
})

test('Barrier Node - barrier.makeBarrier', function (t) {
  const barrierNode = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      type: 'CUSTOM',
      frames: []
    }]
  })

  t.equal(barrierNode.isWrapper, true)
  barrierNode.makeBarrier()
  t.equal(barrierNode.isWrapper, false)
  t.end()
})

test('Barrier Node - barrier.initializeAsWrapper', function (t) {
  const barrierNodeRoot = new BarrierNode(1, 0)
  const barrierNodeNormal = new BarrierNode(2, 1)

  const aggregateNodeRoot = new FakeAggregateNode({
    aggregateId: 1,
    parentAggregateId: 0,
    children: [2],
    isRoot: true
  })
  const aggregateNodeNormal = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [3, 4],
    type: 'CUSTOM',
    frames: []
  })

  barrierNodeRoot.initializeAsWrapper(aggregateNodeRoot, [2])
  t.equal(barrierNodeRoot.isRoot, true)
  t.strictSame(barrierNodeRoot.toJSON(), {
    barrierId: 1,
    parentBarrierId: 0,
    children: [2],
    name: null,
    isWrapper: true,
    nodes: [aggregateNodeRoot.toJSON()]
  })

  barrierNodeNormal.initializeAsWrapper(aggregateNodeNormal, [3, 4])
  t.equal(barrierNodeNormal.isRoot, false)
  t.strictSame(barrierNodeNormal.toJSON(), {
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4],
    name: null,
    isWrapper: true,
    nodes: [aggregateNodeNormal.toJSON()]
  })

  t.throws(
    () => barrierNodeNormal.initializeAsWrapper(aggregateNodeNormal, [3, 4]),
    new Error('can not reinitialize BarrierNode: 2')
  )
  t.end()
})

test('Barrier Node - barrier.initializeAsCombined', function (t) {
  const barrierNode = new BarrierNode(2, 1)
  const aggregateNodeA = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [3, 4],
    type: 'CUSTOM_A',
    frames: []
  })
  const aggregateNodeB = new FakeAggregateNode({
    aggregateId: 5,
    parentAggregateId: 1,
    children: [6, 7],
    type: 'CUSTOM_B',
    frames: []
  })
  barrierNode.initializeAsCombined(
    [aggregateNodeA, aggregateNodeB],
    [3, 4, 6, 7]
  )

  t.strictSame(barrierNode.toJSON(), {
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4, 6, 7],
    name: null,
    isWrapper: false,
    nodes: [aggregateNodeA.toJSON(), aggregateNodeB.toJSON()]
  })
  t.throws(
    function () {
      barrierNode.initializeAsCombined(
        [aggregateNodeA, aggregateNodeB],
        [3, 4, 6, 7]
      )
    },
    new Error('can not reinitialize BarrierNode: 2')
  )
  t.end()
})

test('Barrier Node - barrier.combineChildren', function (t) {
  const barrierNodeParent = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4, 5],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4, 5],
      type: 'PARENT',
      frames: []
    }]
  })

  const barrierNodeCat1Node1 = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 1,
      type: 'CATEGORY_1_NODE_1',
      frames: []
    }]
  })

  const barrierNodeCat1Node2 = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 1,
      type: 'CATEGORY_1_NODE_2',
      frames: []
    }]
  })

  const barrierNodeCat2Node1 = new FakeBarrierNode({
    barrierId: 5,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 5,
      parentAggregateId: 1,
      type: 'CATEGORY_2_NODE_1',
      frames: []
    }]
  })

  const barrierNodeOrphan = new FakeBarrierNode({
    barrierId: 6,
    parentBarrierId: 0,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 6,
      parentAggregateId: 1,
      type: 'ORPHAN',
      frames: []
    }]
  })

  const barrierNodeCat1Combined = barrierNodeParent.combineChildren(
    [barrierNodeCat1Node1, barrierNodeCat1Node2]
  )

  t.strictSame(barrierNodeParent.toJSON(), {
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 5],
    name: null,
    isWrapper: true,
    nodes: [barrierNodeParent.nodes[0].toJSON()]
  })

  t.strictSame(barrierNodeCat1Combined.toJSON(), {
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    name: null,
    isWrapper: false,
    nodes: [
      barrierNodeCat1Node1.nodes[0].toJSON(),
      barrierNodeCat1Node2.nodes[0].toJSON()
    ]
  })

  t.strictSame(barrierNodeCat2Node1.toJSON(), {
    barrierId: 5,
    parentBarrierId: 2,
    children: [],
    name: null,
    isWrapper: true,
    nodes: [barrierNodeCat2Node1.nodes[0].toJSON()]
  })

  t.throws(
    function () {
      barrierNodeParent.combineChildren(
        [barrierNodeOrphan, barrierNodeCat1Node1]
      )
    },
    new Error('BarrierNode 6 is not a child of BarrierNode 2')
  )

  t.end()
})
