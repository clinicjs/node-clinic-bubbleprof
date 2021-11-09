'use strict'

const test = require('tap').test
const util = require('util')
const AggregateNode = require('../analysis/aggregate/aggregate-node.js')
const { FakeAggregateNode, FakeSourceNode } = require('./analysis-util')

test('Aggregate Node - aggregate.mark.format', function (t) {
  const aggregateNode = new AggregateNode(1, 0)
  t.strictSame(util.inspect(aggregateNode.mark, { depth: -1 }), '<Mark>')

  t.strictSame(aggregateNode.mark.format(), 'null')
  aggregateNode.mark.set(0, 'party')
  t.strictSame(aggregateNode.mark.format(), 'party')
  aggregateNode.mark.set(1, 'module')
  t.strictSame(aggregateNode.mark.format(), 'party.module')
  aggregateNode.mark.set(2, 'name')
  t.strictSame(aggregateNode.mark.format(), 'party.module.name')

  const aggregateNodePartial = new AggregateNode(1, 0)
  aggregateNodePartial.mark.set(2, 'name')
  t.strictSame(aggregateNodePartial.mark.format(), 'null')
  aggregateNodePartial.mark.set(0, 'party')
  t.strictSame(aggregateNodePartial.mark.format(), 'party')

  t.end()
})

test('Aggregate Node - aggregate.mark.inspect', function (t) {
  const aggregateNode = new AggregateNode(1, 0)
  t.strictSame(util.inspect(aggregateNode.mark, { depth: -1 }), '<Mark>')

  t.strictSame(util.inspect(aggregateNode.mark), '<Mark null>')
  aggregateNode.mark.set(0, 'party')
  t.strictSame(util.inspect(aggregateNode.mark), '<Mark party>')
  aggregateNode.mark.set(1, 'module')
  t.strictSame(util.inspect(aggregateNode.mark), '<Mark party.module>')
  aggregateNode.mark.set(2, 'name')
  t.strictSame(util.inspect(aggregateNode.mark), '<Mark party.module.name>')

  const aggregateNodePartial = new AggregateNode(1, 0)
  aggregateNodePartial.mark.set(2, 'name')
  t.strictSame(util.inspect(aggregateNodePartial.mark), '<Mark null>')
  aggregateNodePartial.mark.set(0, 'party')
  t.strictSame(util.inspect(aggregateNodePartial.mark), '<Mark party>')

  t.end()
})

test('Aggregate Node - aggregate.mark.toJSON', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  t.strictSame(aggregateNode.mark.toJSON(), [null, null, null])
  aggregateNode.mark.set(0, 'party')
  t.strictSame(aggregateNode.mark.toJSON(), ['party', null, null])
  aggregateNode.mark.set(1, 'module')
  t.strictSame(aggregateNode.mark.toJSON(), ['party', 'module', null])
  aggregateNode.mark.set(2, 'name')
  t.strictSame(aggregateNode.mark.toJSON(), ['party', 'module', 'name'])

  t.end()
})

test('Aggregate Node - aggregate.mark.set', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  aggregateNode.mark.set(0, 'party')
  aggregateNode.mark.set(1, 'module')
  aggregateNode.mark.set(2, 'name')
  t.strictSame(aggregateNode.mark.toJSON(), ['party', 'module', 'name'])

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

  t.equal(aggregateNode.mark.get(0), 'party')
  t.equal(aggregateNode.mark.get(1), 'module')
  t.equal(aggregateNode.mark.get(2), 'name')

  t.throws(
    () => aggregateNode.mark.get(3),
    new RangeError('index 3 is out of range in mark object')
  )

  t.end()
})

test('Aggregate Node - aggregate.inspect', function (t) {
  const aggregateNode = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [1, 2, 3],
    mark: ['party', 'module', 'name'],
    type: 'CUSTOM',
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ]
  })

  t.equal(
    util.inspect(aggregateNode, { depth: null }),
    '<AggregateNode type:CUSTOM, mark:<Mark party.module.name>,' +
    ' aggregateId:2, parentAggregateId:1, sources.length:1,' +
    ' children:[1, 2, 3], frames:<Frames [\n' +
    '         <Frame <anonymous> fileName.js:>]>>'
  )

  t.equal(
    util.inspect(aggregateNode, { depth: 2 }),
    '<AggregateNode type:CUSTOM, mark:<Mark party.module.name>,' +
    ' aggregateId:2, parentAggregateId:1, sources.length:1,' +
    ' children:[1, 2, 3], frames:<Frames [\n' +
    '         <Frame <anonymous> fileName.js:>]>>'
  )

  t.equal(
    util.inspect(aggregateNode, { depth: 1 }),
    '<AggregateNode type:CUSTOM, mark:<Mark party.module.name>,' +
    ' aggregateId:2, parentAggregateId:1, sources.length:1,' +
    ' children:[1, 2, 3], frames:<Frames [<Frame>]>>'
  )

  t.equal(
    util.inspect(aggregateNode, { depth: 0 }),
    '<AggregateNode type:CUSTOM, mark:<Mark>,' +
    ' aggregateId:2, parentAggregateId:1, sources.length:1,' +
    ' children:[1, 2, 3], frames:<Frames>>'
  )

  t.equal(
    util.inspect(aggregateNode, { depth: -1 }),
    '<AggregateNode>'
  )

  t.end()
})

test('Aggregate Node - aggregate.inspect', function (t) {
  const aggregateNode = new FakeAggregateNode({
    aggregateId: 2,
    parentAggregateId: 1,
    children: [1, 2, 3],
    mark: ['party', 'module', 'name'],
    type: 'CUSTOM',
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ]
  })

  t.strictSame(aggregateNode.toJSON(), {
    aggregateId: 2,
    parentAggregateId: 1,
    children: [1, 2, 3],
    name: null,
    mark: ['party', 'module', 'name'],
    type: 'CUSTOM',
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    sources: [aggregateNode.sources[0].toJSON({ short: true })]
  })

  t.end()
})

test('Aggregate Node - aggregate.makeRoot', function (t) {
  const aggregateNode = new AggregateNode(1, 0)
  aggregateNode.makeRoot()

  t.equal(aggregateNode.isRoot, true)
  t.strictSame(aggregateNode.toJSON(), {
    aggregateId: 1,
    parentAggregateId: 0,
    children: [],
    name: null,
    mark: ['root', null, null],
    type: null,
    frames: [],
    sources: [{
      asyncId: 1,
      parentAsyncId: null,
      triggerAsyncId: null,
      executionAsyncId: null,
      init: null,
      before: [],
      after: [],
      destroy: null
    }]
  })

  t.end()
})

test('Aggregate Node - aggregate.addChild', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  aggregateNode.addChild(1)
  t.strictSame(aggregateNode.toJSON().children, [1])

  aggregateNode.addChild(2)
  t.strictSame(aggregateNode.toJSON().children, [1, 2])

  t.end()
})

test('Aggregate Node - aggregate.getChildren', function (t) {
  const aggregateNode = new AggregateNode(1, 0)

  aggregateNode.addChild(1)
  t.strictSame(aggregateNode.getChildren(), [1])

  aggregateNode.addChild(2)
  t.strictSame(aggregateNode.getChildren(), [1, 2])

  t.end()
})

test('Aggregate Node - aggregate.addSourceNode', function (t) {
  const sourceNodeA = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })
  const sourceNodeB = new FakeSourceNode({
    asyncId: 3,
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 2,
    before: [3, 5],
    after: [4, 6],
    destroy: 7
  })

  const aggregateNode = new AggregateNode(1, 0)
  aggregateNode.addSourceNode(sourceNodeA)
  t.strictSame(aggregateNode.toJSON(), {
    aggregateId: 1,
    parentAggregateId: 0,
    children: [],
    mark: [null, null, null],
    name: null,
    type: 'CUSTOM',
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    sources: [sourceNodeA.toJSON({ short: true })]
  })

  aggregateNode.addSourceNode(sourceNodeB)
  t.strictSame(aggregateNode.toJSON(), {
    aggregateId: 1,
    parentAggregateId: 0,
    children: [],
    mark: [null, null, null],
    name: null,
    type: 'CUSTOM',
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    sources: [
      sourceNodeA.toJSON({ short: true }),
      sourceNodeB.toJSON({ short: true })
    ]
  })

  t.end()
})

test('Aggregate Node - aggregate.addSourceNode', function (t) {
  const sourceNodeA = new FakeSourceNode({
    asyncId: 2,
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 1,
    before: [2, 4],
    after: [3, 5],
    destroy: 6
  })
  const sourceNodeB = new FakeSourceNode({
    asyncId: 3,
    frames: [
      { fileName: 'fileName.js', isToplevel: true }
    ],
    type: 'CUSTOM',
    triggerAsyncId: 1,
    executionAsyncId: 0,
    init: 2,
    before: [3, 5],
    after: [4, 6],
    destroy: 7
  })

  const aggregateNode = new AggregateNode(1, 0)
  aggregateNode.addSourceNode(sourceNodeA)
  t.strictSame(aggregateNode.getSourceNodes(), [sourceNodeA])

  aggregateNode.addSourceNode(sourceNodeB)
  t.strictSame(aggregateNode.getSourceNodes(), [
    sourceNodeA, sourceNodeB
  ])

  t.end()
})
