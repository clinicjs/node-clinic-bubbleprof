'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const MakeExternalBarrierNode = require('../analysis/barrier/make-external-barrier-nodes.js')
const { FakeBarrierNode, FakeSystemInfo } = require('./analysis-util')

function createTreeStructure () {
  // root - 1
  //   parent (user) - 2
  //      child (external) - 5
  //      child (user) - 6
  //   parent (external) - 3
  //      child (external) - 7
  //      child (user) - 8
  //   parent (user + external = both) - 4
  //      child (external) - 9
  //      child (user) - 10

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

  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2, 3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2, 3, 4],
      isRoot: true
    }]
  })

  const barrierNodeParentUser = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [6, 7],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'PARENT_USER',
      frames: [frameUser, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeParentExternal = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 1,
    children: [8, 9],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 1,
      children: [8, 9],
      type: 'PARENT_EXTERNAL',
      frames: [frameExternal, frameNodecore]
    }]
  })

  const barrierNodeParentBoth = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 1,
    children: [10, 11],
    isWrapper: false,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 1,
      children: [10],
      type: 'PARENT_USER',
      frames: [frameUser, frameExternal, frameNodecore]
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [11],
      type: 'PARENT_EXTERNAL',
      frames: [frameExternal, frameNodecore]
    }]
  })

  function createSubtreeStructure (parentNode) {
    const barrierNodeChildUser = new FakeBarrierNode({
      barrierId: parentNode.children[0],
      parentBarrierId: parentNode.barrierId,
      children: [],
      isWrapper: true,
      nodes: [{
        aggregateId: parentNode.children[0],
        parentAggregateId: parentNode.barrierId,
        children: [],
        type: 'CHILD_USER',
        frames: [frameUser, frameExternal, frameNodecore]
      }]
    })

    const barrierNodeChildExternal = new FakeBarrierNode({
      barrierId: parentNode.children[1],
      parentBarrierId: parentNode.barrierId,
      children: [],
      isWrapper: true,
      nodes: [{
        aggregateId: parentNode.children[1],
        parentAggregateId: parentNode.barrierId,
        children: [],
        type: 'CHILD_EXTERNAL',
        frames: [frameExternal, frameNodecore]
      }]
    })

    return [barrierNodeChildUser, barrierNodeChildExternal]
  }

  return [
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeParentExternal,
    barrierNodeParentBoth,
    ...createSubtreeStructure(barrierNodeParentUser),
    ...createSubtreeStructure(barrierNodeParentExternal),
    ...createSubtreeStructure(barrierNodeParentBoth)
  ]
}

function extractState (barrierNode) {
  return {
    barrierId: barrierNode.barrierId,
    parentBarrierId: barrierNode.parentBarrierId,
    children: barrierNode.children,
    isWrapper: barrierNode.isWrapper,
    nodes: barrierNode.nodes.map((aggregateNode) => aggregateNode.aggregateId)
  }
}

function checkTreeStructure (t, barrierNodes) {
  const [
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeParentExternal,
    barrierNodeParentBoth,
    barrierNodeParentUserChildUser,
    barrierNodeParentUserChildExternal,
    barrierNodeParentExternalChildUser,
    barrierNodeParentExternalChildExternal,
    barrierNodeParentBothChildUser,
    barrierNodeParentBothChildExternal
  ] = barrierNodes

  t.strictSame(extractState(barrierNodeRoot), {
    barrierId: 1,
    parentBarrierId: 0,
    isWrapper: true,
    children: [2, 3, 4],
    nodes: [1]
  })

  t.strictSame(extractState(barrierNodeParentUser), {
    barrierId: 2,
    parentBarrierId: 1,
    isWrapper: true,
    children: [6, 7],
    nodes: [2]
  })

  t.strictSame(extractState(barrierNodeParentExternal), {
    barrierId: 3,
    parentBarrierId: 1,
    isWrapper: false,
    children: [8, 9],
    nodes: [3]
  })

  t.strictSame(extractState(barrierNodeParentBoth), {
    barrierId: 4,
    parentBarrierId: 1,
    isWrapper: false,
    children: [10, 11],
    nodes: [4, 5]
  })

  t.strictSame(extractState(barrierNodeParentUserChildUser), {
    barrierId: 6,
    parentBarrierId: 2,
    isWrapper: true,
    children: [],
    nodes: [6]
  })

  t.strictSame(extractState(barrierNodeParentUserChildExternal), {
    barrierId: 7,
    parentBarrierId: 2,
    isWrapper: false,
    children: [],
    nodes: [7]
  })

  t.strictSame(extractState(barrierNodeParentExternalChildUser), {
    barrierId: 8,
    parentBarrierId: 3,
    isWrapper: false,
    children: [],
    nodes: [8]
  })

  t.strictSame(extractState(barrierNodeParentExternalChildExternal), {
    barrierId: 9,
    parentBarrierId: 3,
    isWrapper: true,
    children: [],
    nodes: [9]
  })

  t.strictSame(extractState(barrierNodeParentBothChildUser), {
    barrierId: 10,
    parentBarrierId: 4,
    isWrapper: true,
    children: [],
    nodes: [10]
  })

  t.strictSame(extractState(barrierNodeParentBothChildExternal), {
    barrierId: 11,
    parentBarrierId: 4,
    isWrapper: true,
    children: [],
    nodes: [11]
  })
}

test('Barrier Node - make external', function (t) {
  const barrierNodesInput = createTreeStructure()
  const systemInfo = new FakeSystemInfo('/')

  startpoint(barrierNodesInput, { objectMode: true })
    .pipe(new MakeExternalBarrierNode(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, barrierNodesOutput) {
      if (err) return t.error(err)

      checkTreeStructure(t, barrierNodesOutput)
      t.end()
    }))
})
