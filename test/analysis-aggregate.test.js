'use strict'

const test = require('tap').test
const util = require('util')
const AggregateNode = require('../analysis/aggregate/aggregate-node.js')

test('Aggregate Node - aggregate.mark.set', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  aggregateNode.mark.set(0, 'party')
  aggregateNode.mark.set(1, 'module')
  aggregateNode.mark.set(2, 'name')
  t.strictDeepEqual(aggregateNode.mark.toJSON(), ['party', 'module', 'name'])

  t.throws(
    () => aggregateNode.mark.set(3, 'extra'),
    new RangeError('index 3 is out of range in mark object')
  )

  t.end()
})

test('Aggregate Node - aggregate.mark.get', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  aggregateNode.mark.set(0, 'party')
  aggregateNode.mark.set(1, 'module')
  aggregateNode.mark.set(2, 'name')

  t.strictEqual(aggregateNode.mark.get(0), 'party')
  t.strictEqual(aggregateNode.mark.get(1), 'module')
  t.strictEqual(aggregateNode.mark.get(2), 'name')

  t.throws(
    () => aggregateNode.mark.get(3),
    new RangeError('index 3 is out of range in mark object')
  )

  t.end()
})

test('Aggregate Node - aggregate.mark.toJSON', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  t.strictDeepEqual(aggregateNode.mark.toJSON(), [null, null, null])
  aggregateNode.mark.set(0, 'party')
  t.strictDeepEqual(aggregateNode.mark.toJSON(), ['party', null, null])
  aggregateNode.mark.set(1, 'module')
  t.strictDeepEqual(aggregateNode.mark.toJSON(), ['party', 'module', null])
  aggregateNode.mark.set(2, 'name')
  t.strictDeepEqual(aggregateNode.mark.toJSON(), ['party', 'module', 'name'])

  t.end()
})

test('Aggregate Node - aggregate.mark.inspect', function (t) {
  const aggregateNode = new AggregateNode(1, 0)
  t.strictDeepEqual(util.inspect(aggregateNode.mark, {depth: -1}), '<Mark>')

  t.strictDeepEqual(util.inspect(aggregateNode.mark), '<Mark null>')
  aggregateNode.mark.set(0, 'party')
  t.strictDeepEqual(util.inspect(aggregateNode.mark), '<Mark party>')
  aggregateNode.mark.set(1, 'module')
  t.strictDeepEqual(util.inspect(aggregateNode.mark), '<Mark party.module>')
  aggregateNode.mark.set(2, 'name')
  t.strictDeepEqual(util.inspect(aggregateNode.mark), '<Mark party.module.name>')

  const aggregateNodePartial = new AggregateNode(1, 0)
  aggregateNodePartial.mark.set(2, 'name')
  t.strictDeepEqual(util.inspect(aggregateNodePartial.mark), '<Mark null>')
  aggregateNodePartial.mark.set(0, 'party')
  t.strictDeepEqual(util.inspect(aggregateNodePartial.mark), '<Mark party>')

  t.end()
})
