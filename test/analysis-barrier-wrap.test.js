'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const WrapAsBarrierNode = require('../analysis/barrier/wrap-as-barrier-nodes.js')
const { FakeAggregateNode } = require('./analysis-util')

test('Barrier Node - wrap', function (t) {
  const aggregateNode = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [3, 4],
    type: 'CUSTOM',
    frames: []
  })

  startpoint([aggregateNode], { objectMode: true })
    .pipe(new WrapAsBarrierNode())
    .pipe(endpoint({ objectMode: true }, function (err, nodes) {
      if (err) return t.error(err)

      t.strictSame(nodes[0].toJSON(), {
        barrierId: 2,
        parentBarrierId: 1,
        children: [3, 4],
        name: null,
        isWrapper: true,
        nodes: [aggregateNode.toJSON()]
      })
      t.end()
    }))
})
