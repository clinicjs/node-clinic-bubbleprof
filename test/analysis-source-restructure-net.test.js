'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const RestructureNetSourceNodes = require('../analysis/source/restructure-net-source-nodes.js')
const { FakeSourceNode } = require('./analysis-util')

function createTreeStructure (serverWrapType, socketWrapType) {
  const sourceNodeRoot = new FakeSourceNode({
    asyncId: 1,
    frames: [],
    type: 'root',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 10
  })

  const sourceNodeServer = new FakeSourceNode({
    asyncId: 2,
    frames: [],
    type: serverWrapType,
    triggerAsyncId: 1,
    executionAsyncId: 1, // server is created from the root node
    init: 2,
    destroy: 10
  })

  const sourceNodeSocket = new FakeSourceNode({
    asyncId: 3,
    frames: [],
    type: socketWrapType,
    triggerAsyncId: 2, // The server is the trigger
    executionAsyncId: 0, // TCPWRAP is created from the void
    init: 3,
    destroy: 9
  })

  // HTTP parser should continue to have the socket as its parent
  const sourceNodeHttpParser = new FakeSourceNode({
    asyncId: 4,
    frames: [],
    type: 'HTTPPARSER',
    triggerAsyncId: 3, // TCPWRAP is the trigger
    executionAsyncId: 2, // HTTPPARSER is created by the server.onconnection
    init: 4,
    destroy: 9
  })

  // HTTPPARSER emits event
  const sourceNodeReady = new FakeSourceNode({
    asyncId: 5,
    frames: [],
    type: 'TickObject',
    triggerAsyncId: 4, // TCPWRAP is the trigger
    executionAsyncId: 4,
    init: 5,
    destroy: 7
  })

  // WRITEWRAP should have its execution context as its parent
  const sourceNodeWriteWrap = new FakeSourceNode({
    asyncId: 6,
    frames: [],
    type: 'WRITEWRAP',
    triggerAsyncId: 3, // TCPWRAP is the trigger
    executionAsyncId: 5,
    init: 6,
    destroy: 8
  })

  // SourceNodes with an uknown parent are kept
  const sourceNodeUnknownParent = new FakeSourceNode({
    asyncId: 7,
    frames: [],
    type: 'UNKNOWN',
    triggerAsyncId: 10, // Unknown parent
    executionAsyncId: 0,
    init: 2,
    destroy: 10
  })

  return [
    sourceNodeRoot, sourceNodeServer, sourceNodeSocket,
    sourceNodeHttpParser, sourceNodeReady, sourceNodeWriteWrap,
    sourceNodeUnknownParent
  ]
}

function checkTreeStructure (t, sourceNodes) {
  const sourceNodeIndex = new Map()
  for (const sourceNode of sourceNodes) {
    sourceNodeIndex.set(sourceNode.asyncId, sourceNode)
  }

  const sourceNodeRoot = sourceNodeIndex.get(1)
  const sourceNodeServer = sourceNodeIndex.get(2)
  const sourceNodeSocket = sourceNodeIndex.get(3)
  const sourceNodeHttpParser = sourceNodeIndex.get(4)
  const sourceNodeReady = sourceNodeIndex.get(5)
  const sourceNodeWriteWrap = sourceNodeIndex.get(6)
  const sourceNodeUnknownParent = sourceNodeIndex.get(7)

  t.equal(sourceNodeRoot.parentAsyncId, 0)
  t.equal(sourceNodeServer.parentAsyncId, 1)
  t.equal(sourceNodeSocket.parentAsyncId, 2)
  t.equal(sourceNodeHttpParser.parentAsyncId, 3)
  t.equal(sourceNodeReady.parentAsyncId, 4)
  t.equal(sourceNodeWriteWrap.parentAsyncId, 5)
  t.equal(sourceNodeUnknownParent.parentAsyncId, 10)
}

test('Source Node - restructure net - tcp right order', function (t) {
  const sourceNodesInput = createTreeStructure('TCPSERVERWRAP', 'TCPWRAP')

  startpoint(sourceNodesInput, { objectMode: true })
    .pipe(new RestructureNetSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, sourceNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, sourceNodesOutput)
      t.end()
    }))
})

test('Source Node - restructure net - tcp wrong order', function (t) {
  const sourceNodesInput = createTreeStructure('TCPSERVERWRAP', 'TCPWRAP')
    .reverse()

  startpoint(sourceNodesInput, { objectMode: true })
    .pipe(new RestructureNetSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, sourceNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, sourceNodesOutput)
      t.end()
    }))
})

test('Source Node - restructure net - pipe right order', function (t) {
  const sourceNodesInput = createTreeStructure('PIPESERVERWRAP', 'PIPEWRAP')

  startpoint(sourceNodesInput, { objectMode: true })
    .pipe(new RestructureNetSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, sourceNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, sourceNodesOutput)
      t.end()
    }))
})

test('Source Node - restructure net - pipe wrong order', function (t) {
  const sourceNodesInput = createTreeStructure('PIPESERVERWRAP', 'PIPEWRAP')
    .reverse()

  startpoint(sourceNodesInput, { objectMode: true })
    .pipe(new RestructureNetSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, sourceNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, sourceNodesOutput)
      t.end()
    }))
})
