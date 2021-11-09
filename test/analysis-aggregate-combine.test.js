'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const { FakeSourceNode } = require('./analysis-util')
const CombineAsAggregateNodes = require('../analysis/aggregate/combine-as-aggregate-nodes.js')

test('Aggregate Node - combine', function (t) {
  const serverNode = new FakeSourceNode({
    asyncId: 2,
    frames: [{ fileName: 'server.js' }],
    identifier: 'server.js',
    type: 'CUSTOM_SERVER',
    triggerAsyncId: 1,
    executionAsyncId: 1,
    init: 1,
    destroy: 10
  })

  const socketNodes = []
  const logNodes = []
  const endNodes = []
  for (let i = 0; i < 2; i++) {
    const socketAsyncId = 3 + i * 3
    const logAsyncId = 4 + i * 3
    const endAsyncId = 5 + i * 3

    const socketNodeSocket = new FakeSourceNode({
      asyncId: socketAsyncId,
      frames: [{ fileName: 'server.js' }],
      identifier: 'server.js',
      type: 'CUSTOM_SOCKET',
      executionAsyncId: 0,
      triggerAsyncId: 2,
      init: 2 + i * 2,
      destroy: 4 + i * 2
    })
    socketNodes.push(socketNodeSocket)

    const socketNodelog = new FakeSourceNode({
      asyncId: logAsyncId,
      frames: [{ fileName: 'log.js' }],
      identifier: 'log.js',
      type: 'CUSTOM_LOG',
      executionAsyncId: socketAsyncId,
      triggerAsyncId: socketAsyncId,
      init: 3 + i * 2,
      destroy: 4 + i * 2
    })
    logNodes.push(socketNodelog)

    const socketNodeEnd = new FakeSourceNode({
      asyncId: endAsyncId,
      frames: [{ fileName: 'server.js' }],
      identifier: 'server.js',
      type: 'CUSTOM_END',
      executionAsyncId: logAsyncId,
      triggerAsyncId: socketAsyncId,
      init: 3 + i * 2,
      destroy: 4 + i * 2
    })
    endNodes.push(socketNodeEnd)
  }

  const sourceNodes = [serverNode, ...socketNodes, ...logNodes, ...endNodes]
  startpoint(sourceNodes, { objectMode: true })
    .pipe(new CombineAsAggregateNodes())
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodes) {
      if (err) return t.error(err)

      // root
      t.strictSame(aggregateNodes[0].toJSON(), {
        aggregateId: 1,
        parentAggregateId: 0,
        children: [2],
        sources: [aggregateNodes[0].sources[0].toJSON({ short: true })],
        mark: ['root', null, null],
        name: null,
        type: null,
        frames: []
      })

      // server
      t.strictSame(aggregateNodes[1].toJSON(), {
        aggregateId: 2,
        parentAggregateId: 1,
        children: [3],
        sources: [serverNode.toJSON({ short: true })],
        mark: [null, null, null],
        name: null,
        type: 'CUSTOM_SERVER',
        frames: [{ fileName: 'server.js' }]
      })

      // socket
      t.strictSame(aggregateNodes[2].toJSON(), {
        aggregateId: 3,
        parentAggregateId: 2,
        children: [4, 5],
        sources: socketNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        name: null,
        type: 'CUSTOM_SOCKET',
        frames: [{ fileName: 'server.js' }]
      })

      // log
      t.strictSame(aggregateNodes[3].toJSON(), {
        aggregateId: 4,
        parentAggregateId: 3,
        children: [],
        sources: logNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        name: null,
        type: 'CUSTOM_LOG',
        frames: [{ fileName: 'log.js' }]
      })

      // end
      t.strictSame(aggregateNodes[4].toJSON(), {
        aggregateId: 5,
        parentAggregateId: 3,
        children: [],
        sources: endNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        name: null,
        type: 'CUSTOM_END',
        frames: [{ fileName: 'server.js' }]
      })

      t.end()
    }))
})
