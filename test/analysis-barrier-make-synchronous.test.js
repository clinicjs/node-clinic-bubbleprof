'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const MakeSynchronousBarrierNodes = require('../analysis/barrier/make-synchronous-barrier-nodes.js')
const { FakeBarrierNode, FakeSystemInfo } = require('./analysis-util')

function createTreeStructure () {
  // root - 1
  //   parent - 2
  //      standalone barrier - 3
  //      matching stack A - 4
  //      matching stack A - 5
  //      not matching stack - 6
  //      matching stack B - 7
  //      matching stack B - 8
  //        will be remapped - 9

  const frameUserBranchA = {
    functionName: 'userBranchA',
    isToplevel: true,
    fileName: '/user/branch.js',
    lineNumber: 10
  }
  const frameUserBranchB = {
    functionName: 'userBranchB',
    isToplevel: true,
    fileName: '/user/branch.js',
    lineNumber: 40
  }
  const frameUserMainA = {
    functionName: 'userMainA',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 10
  }
  const frameUserMainB = {
    functionName: 'userMainB',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 40
  }
  const frameUserMainC = {
    functionName: 'userMainC',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 80
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
    children: [2],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2],
      isRoot: true
    }]
  })

  const barrierNodeParent = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [3, 4, 5, 6, 7, 8],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [3, 4, 5, 6, 7, 8],
      type: 'PARENT',
      frames: [frameNodecore]
    }]
  })

  const barrierNodeBarrier = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 2,
    children: [],
    isWrapper: false,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 2,
      children: [],
      type: 'STANDALONE_BARRIER',
      frames: [frameUserBranchA, frameUserMainA, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeBranchAA = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 2,
      children: [],
      type: 'BRANCH_A',
      frames: [frameUserBranchA, frameUserMainA, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeBranchAB = new FakeBarrierNode({
    barrierId: 5,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 5,
      parentAggregateId: 2,
      children: [],
      type: 'BRANCH_B',
      frames: [frameUserBranchB, frameUserMainA, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeWrapper = new FakeBarrierNode({
    barrierId: 6,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 6,
      parentAggregateId: 2,
      children: [],
      type: 'BRANCH_A',
      frames: [frameUserBranchA, frameUserMainC, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeBranchBA = new FakeBarrierNode({
    barrierId: 7,
    parentBarrierId: 2,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 7,
      parentAggregateId: 2,
      children: [],
      type: 'BRANCH_A',
      frames: [frameUserBranchA, frameUserMainB, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeBranchBB = new FakeBarrierNode({
    barrierId: 8,
    parentBarrierId: 2,
    children: [9],
    isWrapper: true,
    nodes: [{
      aggregateId: 8,
      parentAggregateId: 2,
      children: [9],
      type: 'BRANCH_B',
      frames: [frameUserBranchB, frameUserMainB, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeRemappend = new FakeBarrierNode({
    barrierId: 9,
    parentBarrierId: 8,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 9,
      parentAggregateId: 8,
      children: [],
      type: 'REMAPPED',
      frames: [frameUserBranchB, frameUserMainC, frameExternal, frameNodecore]
    }]
  })

  return [
    barrierNodeRoot,
    barrierNodeParent,
    barrierNodeBarrier,
    barrierNodeBranchAA, barrierNodeBranchAB,
    barrierNodeWrapper,
    barrierNodeBranchBA, barrierNodeBranchBB,
    barrierNodeRemappend
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
    barrierNodeParent,
    barrierNodeBarrier,
    barrierNodeBranchA,
    barrierNodeWrapper,
    barrierNodeBranchB,
    barrierNodeRemappend
  ] = barrierNodes

  t.strictSame(extractState(barrierNodeRoot), {
    barrierId: 1,
    parentBarrierId: 0,
    isWrapper: true,
    children: [2],
    nodes: [1]
  })
  t.strictSame(extractState(barrierNodeParent), {
    barrierId: 2,
    parentBarrierId: 1,
    isWrapper: true,
    children: [3, 4, 6, 7],
    nodes: [2]
  })
  t.strictSame(extractState(barrierNodeBarrier), {
    barrierId: 3,
    parentBarrierId: 2,
    isWrapper: false,
    children: [],
    nodes: [3]
  })
  t.strictSame(extractState(barrierNodeBranchA), {
    barrierId: 4,
    parentBarrierId: 2,
    isWrapper: false,
    children: [],
    nodes: [4, 5]
  })
  t.strictSame(extractState(barrierNodeWrapper), {
    barrierId: 6,
    parentBarrierId: 2,
    isWrapper: true,
    children: [],
    nodes: [6]
  })
  t.strictSame(extractState(barrierNodeBranchB), {
    barrierId: 7,
    parentBarrierId: 2,
    isWrapper: false,
    children: [9],
    nodes: [7, 8]
  })
  t.strictSame(extractState(barrierNodeRemappend), {
    barrierId: 9,
    parentBarrierId: 7,
    isWrapper: true,
    children: [],
    nodes: [9]
  })
}

test('Barrier Node - make synchronous', function (t) {
  const barrierNodesInput = createTreeStructure()
  const systemInfo = new FakeSystemInfo('/')

  startpoint(barrierNodesInput, { objectMode: true })
    .pipe(new MakeSynchronousBarrierNodes(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, barrierNodesOutput) {
      if (err) return t.error(err)

      checkTreeStructure(t, barrierNodesOutput)
      t.end()
    }))
})
