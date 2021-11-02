'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const MarkHttpAggregateNodes = require('../analysis/aggregate/mark-http-aggregate-nodes.js')
const { FakeAggregateNode } = require('./analysis-util')

function createTreeStructure (serverWrapType, socketWrapType) {
  const aggregateNodeRoot = new FakeAggregateNode({
    aggregateId: 1,
    parentAggregateId: 0,
    children: [2],
    isRoot: true
  })

  const aggregateNodeServer = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1, // server is created from the root node
    children: [3],
    frames: [],
    mark: ['nodecore', null, null],
    type: serverWrapType
  })

  const aggregateNodeSocket = new FakeAggregateNode({
    aggregateId: 3,
    parentAggregateId: 2, // The server is the trigger
    children: [4],
    frames: [],
    mark: ['nodecore', null, null],
    type: socketWrapType
  })

  // HTTP parser should continue to have the socket as its parent
  const aggregateNodeHttpParser = new FakeAggregateNode({
    aggregateId: 4,
    parentAggregateId: 3,
    children: [5],
    frames: [],
    mark: ['nodecore', null, null],
    type: 'HTTPPARSER'
  })

  // HTTPPARSER emits event
  const aggregateNodeReady = new FakeAggregateNode({
    aggregateId: 5,
    parentAggregateId: 4,
    children: [6],
    frames: [],
    mark: ['nodecore', null, null],
    type: 'TickObject'
  })

  // WRITEWRAP should have its execution context as its parent
  const aggregateNodeWriteWrap = new FakeAggregateNode({
    aggregateId: 6,
    parentAggregateId: 5,
    children: [],
    frames: [],
    mark: ['nodecore', null, null],
    type: 'WRITEWRAP'
  })

  // AggregateNodes with an uknown parent are kept
  const aggregateNodeUnknownParent = new FakeAggregateNode({
    aggregateId: 11,
    parentAggregateId: 10, // Unknown parent
    children: [],
    frames: [],
    mark: ['user', null, null],
    type: 'UNKNOWN'
  })

  // This needs to be in BFS order
  return [
    aggregateNodeRoot, aggregateNodeServer, aggregateNodeSocket,
    aggregateNodeHttpParser, aggregateNodeReady, aggregateNodeWriteWrap,
    aggregateNodeUnknownParent
  ]
}

function checkTreeStructure (t, sourceNodes) {
  const [
    aggregateNodeRoot, aggregateNodeServer, aggregateNodeSocket,
    aggregateNodeHttpParser, aggregateNodeReady, aggregateNodeWriteWrap,
    aggregateNodeUnknownParent
  ] = sourceNodes

  t.equal(aggregateNodeRoot.aggregateId, 1)
  t.equal(aggregateNodeServer.aggregateId, 2)
  t.equal(aggregateNodeSocket.aggregateId, 3)
  t.equal(aggregateNodeHttpParser.aggregateId, 4)
  t.equal(aggregateNodeReady.aggregateId, 5)
  t.equal(aggregateNodeWriteWrap.aggregateId, 6)
  t.equal(aggregateNodeUnknownParent.aggregateId, 11)

  t.strictSame(aggregateNodeRoot.mark.toJSON(),
    ['root', null, null])
  t.strictSame(aggregateNodeServer.mark.toJSON(),
    ['nodecore', 'net', 'server'])
  t.strictSame(aggregateNodeSocket.mark.toJSON(),
    ['nodecore', 'net', 'onconnection'])
  t.strictSame(aggregateNodeHttpParser.mark.toJSON(),
    ['nodecore', 'net', 'onrequest'])
  t.strictSame(aggregateNodeReady.mark.toJSON(),
    ['nodecore', null, null])
  t.strictSame(aggregateNodeWriteWrap.mark.toJSON(),
    ['nodecore', null, null])
  t.strictSame(aggregateNodeUnknownParent.mark.toJSON(),
    ['user', null, null])
}

test('Aggregate Node - mark http - tcp', function (t) {
  const aggregateNodesInput = createTreeStructure('TCPSERVERWRAP', 'TCPWRAP')

  startpoint(aggregateNodesInput, { objectMode: true })
    .pipe(new MarkHttpAggregateNodes())
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, aggregateNodesOutput)
      t.end()
    }))
})

test('Aggregate Node - mark http - pipe', function (t) {
  const aggregateNodesInput = createTreeStructure('PIPESERVERWRAP', 'PIPEWRAP')

  startpoint(aggregateNodesInput, { objectMode: true })
    .pipe(new MarkHttpAggregateNodes())
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodesOutput) {
      if (err) return t.error(err)
      checkTreeStructure(t, aggregateNodesOutput)
      t.end()
    }))
})
