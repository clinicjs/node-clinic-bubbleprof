'use strict'

const test = require('tap').test
const startpoint = require('startpoint')
const HTTPRequestNodes = require('../analysis/source/http-request-nodes.js')
const { FakeSourceNode } = require('./analysis-util')

test('Source Node - http requests', function (t) {
  const nodeServerResponse = new FakeSourceNode({
    asyncId: 1,
    frames: [{ typeName: 'ServerResponse', functionName: 'end' }],
    type: 'TickObject',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const nodeNoStack = new FakeSourceNode({
    asyncId: 2,
    type: 'NO_STACK_TRACE',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const nodeTimer = new FakeSourceNode({
    asyncId: 3,
    frames: [],
    type: 'TIMERWRAP',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 3,
    destroy: 2
  })

  const digest = { runtime: 0, httpRequests: [] }
  const stream = startpoint([nodeServerResponse, nodeNoStack, nodeTimer], { objectMode: true })
    .pipe(new HTTPRequestNodes(digest))

  stream.resume()
  stream.on('end', function () {
    t.equal(digest.runtime, 2)
    t.same(digest.httpRequests, [1])
    t.end()
  })
})
