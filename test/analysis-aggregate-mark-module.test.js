'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const MarkModuleAggregateNodes = require('../analysis/aggregate/mark-module-aggregate-nodes.js')
const { FakeAggregateNode, FakeSystemInfo } = require('./analysis-util')

test('Aggregate Node - mark module', function (t) {
  const aggregateNodeRoot = new FakeAggregateNode({
    aggregateId: 1,
    parentAggregateId: 0,
    children: [2, 3, 4],
    isRoot: true
  })

  const aggregateNodeNodecore = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: 'internal/process.js' }
    ],
    mark: ['nodecore', null, null],
    type: 'TickObject'
  })

  const aggregateNodeInternal = new FakeAggregateNode({
    aggregateId: 3,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: '/user/internal/index.js' },
      { fileName: 'internal/process.js' }
    ],
    mark: ['user', null, null],
    type: 'TickObject'
  })

  const aggregateNodeExternal = new FakeAggregateNode({
    aggregateId: 4,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: '/node_modules/external/index.js' },
      { fileName: '/node_modules/external/node_modules/deep/index.js' },
      { fileName: 'internal/process.js' }
    ],
    mark: ['external', null, null],
    type: 'TickObject'
  })

  const aggregateNodeEval = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: '/node_modules/promise/lib/core.js' },
      { fileName: '', isEval: true, evalOrigin: 'eval at denodeifyWithoutCount (/node_modules/promise/lib/node-extensions.js:90:10)' }
    ],
    mark: ['external', null, null],
    type: 'TickObject'
  })

  const systemInfo = new FakeSystemInfo('/')
  const aggregateNodesInput = [
    aggregateNodeRoot, aggregateNodeNodecore,
    aggregateNodeInternal, aggregateNodeExternal,
    aggregateNodeEval
  ]

  startpoint(aggregateNodesInput, { objectMode: true })
    .pipe(new MarkModuleAggregateNodes(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodesOutput) {
      if (err) return t.error(err)
      t.strictSame(
        aggregateNodesOutput[0].mark.toJSON(),
        ['root', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[1].mark.toJSON(),
        ['nodecore', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[2].mark.toJSON(),
        ['user', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[3].mark.toJSON(),
        ['external', 'deep', null]
      )
      t.strictSame(
        aggregateNodesOutput[4].mark.toJSON(),
        ['external', 'promise', null]
      )
      t.end()
    }))
})
