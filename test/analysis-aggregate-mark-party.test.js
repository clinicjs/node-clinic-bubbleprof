'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const MarkPartyAggregateNodes = require('../analysis/aggregate/mark-party-aggregate-nodes.js')
const { FakeAggregateNode, FakeSystemInfo } = require('./analysis-util')

test('Aggregate Node - mark party', function (t) {
  const aggregateNodeRoot = new FakeAggregateNode({
    aggregateId: 1,
    parentAggregateId: 0,
    children: [2, 3, 4, 5, 6],
    isRoot: true
  })

  const aggregateNodeNoFramesNodecore = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [],
    frames: [],
    type: 'TCPWRAP'
  })

  const aggregateNodeNoFramesExternal = new FakeAggregateNode({
    aggregateId: 3,
    parentAggregateId: 1,
    children: [],
    frames: [],
    type: 'CUSTOM'
  })

  const aggregateNodeFramesNodecore = new FakeAggregateNode({
    aggregateId: 4,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: 'internal/process.js' },
      { fileName: 'internal/node_bootstrap.js' }
    ],
    type: 'TickObject'
  })

  const aggregateNodeFramesExternal = new FakeAggregateNode({
    aggregateId: 5,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: '/node_modules/external/node_modules/deep/index.js' },
      { fileName: '/node_modules/external/index.js' },
      { fileName: 'internal/process.js' },
      { fileName: 'internal/node_bootstrap.js' }
    ],
    type: 'TickObject'
  })

  const aggregateNodeFramesUser = new FakeAggregateNode({
    aggregateId: 6,
    parentAggregateId: 1,
    children: [],
    frames: [
      { fileName: '/user/internal/index.js' },
      { fileName: '/node_modules/external/node_modules/deep/index.js' },
      { fileName: '/node_modules/external/index.js' },
      { fileName: 'internal/process.js' },
      { fileName: 'internal/node_bootstrap.js' }
    ],
    type: 'TickObject'
  })

  const systemInfo = new FakeSystemInfo('/')
  const aggregateNodesInput = [
    aggregateNodeRoot,
    aggregateNodeNoFramesNodecore, aggregateNodeNoFramesExternal,
    aggregateNodeFramesNodecore, aggregateNodeFramesExternal,
    aggregateNodeFramesUser
  ]

  startpoint(aggregateNodesInput, { objectMode: true })
    .pipe(new MarkPartyAggregateNodes(systemInfo))
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
        ['external', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[3].mark.toJSON(),
        ['nodecore', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[4].mark.toJSON(),
        ['external', null, null]
      )
      t.strictSame(
        aggregateNodesOutput[5].mark.toJSON(),
        ['user', null, null]
      )
      t.end()
    }))
})
