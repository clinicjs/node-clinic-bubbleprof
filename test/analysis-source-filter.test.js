'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const FilterSourceNodes = require('../analysis/source/filter-source-nodes.js')
const { FakeSourceNode } = require('./analysis-util')

test('Source Node - filter', function (t) {
  const nodeNotFiltered = new FakeSourceNode({
    asyncId: 1,
    frames: [],
    type: 'NOT_FILTERED',
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
    init: 1,
    destroy: 2
  })

  startpoint([nodeNotFiltered, nodeNoStack, nodeTimer], { objectMode: true })
    .pipe(new FilterSourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, nodes) {
      if (err) return t.error(err)

      t.equal(nodes.length, 1)
      t.equal(nodes[0], nodeNotFiltered)
      t.end()
    }))
})
