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
    isRoot: true
  })

  const aggregateNodeNodecore = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    frames: [
      { fileName: 'internal/process.js' }
    ],
    mark: ['nodecore', null, null],
    type: 'TickObject'
  })

  const aggregateNodeInternal = new FakeAggregateNode({
    aggregateId: 3,
    parentAggregateId: 1,
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
    frames: [
      { fileName: '/node_modules/external/index.js' },
      { fileName: '/node_modules/external/node_modules/deep/index.js' },
      { fileName: 'internal/process.js' }
    ],
    mark: ['external', null, null],
    type: 'TickObject'
  })

  const systemInfo = new FakeSystemInfo('/')
  const aggregateNodesInput = [
      aggregateNodeRoot, aggregateNodeNodecore,
      aggregateNodeInternal, aggregateNodeExternal
  ]

  startpoint(aggregateNodesInput, { objectMode: true })
    .pipe(new MarkModuleAggregateNodes(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodesOutput) {
      t.strictDeepEqual(
        aggregateNodesOutput[0].mark.toJSON(),
        ['root', null, null]
      )
      t.strictDeepEqual(
        aggregateNodesOutput[1].mark.toJSON(),
        ['nodecore', null, null]
      )
      t.strictDeepEqual(
        aggregateNodesOutput[2].mark.toJSON(),
        ['user', null, null]
      )
      t.strictDeepEqual(
        aggregateNodesOutput[3].mark.toJSON(),
        ['external', 'deep', null]
      )
      t.end()
    }))
})
