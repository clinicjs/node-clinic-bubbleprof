'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const { FakeBarrierNode, FakeSystemInfo } = require('./analysis-util')
const NameBarrierNodes = require('../analysis/barrier/name-barrier-nodes.js')

test('Barrier Node - set name', function (t) {
  const frameUser = {
    functionName: 'userMain',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 10
  }
  const frameExternal = {
    functionName: 'external',
    isToplevel: true,
    fileName: '/node_modules/external/index.js',
    lineNumber: 10
  }
  const frameNodecore = {
    functionName: 'nodecore',
    isToplevel: true,
    fileName: 'internal/process.js',
    lineNumber: 10
  }

  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2, 3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2, 3, 4],
      isRoot: true
    }]
  })

  const barrierNodeParentUser = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [6, 7],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'Immediate',
      frames: [frameUser, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeParentExternal = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 1,
    children: [8, 9],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 1,
      children: [8, 9],
      type: 'TickObject',
      frames: [frameExternal, frameNodecore]
    }]
  })

  const barrierNodeParentBoth = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 1,
    children: [10, 11],
    isWrapper: false,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 1,
      children: [10],
      type: 'Immediate',
      frames: [frameUser, frameExternal, frameNodecore]
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [11],
      type: 'TickObject',
      frames: [frameExternal, frameNodecore]
    }]
  })

  pipeline([
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeParentExternal,
    barrierNodeParentBoth
  ], function (err, names) {
    if (err) return t.error(err)

    t.same(names, [
      'miscellaneous',
      'setImmediate',
      'external',
      'setImmediate + external'
    ])
    t.end()
  })
})

test('Barrier Node - set name with multiple modules in stack', function (t) {
  const frameUser = {
    functionName: 'userMain',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 10
  }
  const frameExternal = {
    functionName: 'external',
    isToplevel: true,
    fileName: '/node_modules/external/index.js',
    lineNumber: 10
  }
  const frameOtherExternal = {
    functionName: 'external',
    isToplevel: true,
    fileName: '/node_modules/other-external/index.js',
    lineNumber: 10
  }
  const frameNodecore = {
    functionName: 'nodecore',
    isToplevel: true,
    fileName: 'internal/process.js',
    lineNumber: 10
  }

  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2, 3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2, 3, 4],
      isRoot: true
    }]
  })

  const barrierNodeParentUser = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [6, 7],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'Immediate',
      frames: [frameUser, frameExternal, frameNodecore]
    }]
  })

  const barrierNodeParentExternal = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 1,
    children: [8, 9],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 1,
      children: [8, 9],
      type: 'TickObject',
      frames: [frameExternal, frameExternal, frameOtherExternal, frameNodecore]
    }]
  })

  const barrierNodeParentBoth = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 1,
    children: [10, 11],
    isWrapper: false,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 1,
      children: [10],
      type: 'Immediate',
      frames: [frameUser, frameExternal, frameNodecore]
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [11],
      type: 'TickObject',
      frames: [frameExternal, frameExternal, frameOtherExternal, frameNodecore]
    }]
  })

  pipeline([
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeParentExternal,
    barrierNodeParentBoth
  ], function (err, names) {
    if (err) return t.error(err)

    t.same(names, [
      'miscellaneous',
      'setImmediate',
      'external > other-external',
      'setImmediate + external > other-external'
    ])
    t.end()
  })
})

test('Barrier Node - set name with too many modules in stack', function (t) {
  const frameUser = {
    functionName: 'userMain',
    isToplevel: true,
    fileName: '/user/main.js',
    lineNumber: 10
  }
  const frameNodecore = {
    functionName: 'nodecore',
    isToplevel: true,
    fileName: 'internal/process.js',
    lineNumber: 10
  }

  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2, 3, 4],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2, 3, 4],
      isRoot: true
    }]
  })

  const barrierNodeParentUser = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [6, 7],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [6, 7],
      type: 'Immediate',
      frames: [frameUser, external('a'), frameNodecore]
    }]
  })

  const barrierNodeParentExternal = new FakeBarrierNode({
    barrierId: 3,
    parentBarrierId: 1,
    children: [8, 9],
    isWrapper: true,
    nodes: [{
      aggregateId: 3,
      parentAggregateId: 1,
      children: [8, 9],
      type: 'TickObject',
      frames: [
        external('a'),
        external('a'),
        external('b'),
        external('c'),
        external('d'),
        external('e'),
        frameNodecore
      ]
    }]
  })

  const barrierNodeParentBoth = new FakeBarrierNode({
    barrierId: 4,
    parentBarrierId: 1,
    children: [10, 11],
    isWrapper: false,
    nodes: [{
      aggregateId: 4,
      parentAggregateId: 1,
      children: [10],
      type: 'Immediate',
      frames: [frameUser, external('a'), frameNodecore]
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [11],
      type: 'TickObject',
      frames: [
        external('a'),
        external('a'),
        external('b'),
        external('c'),
        external('d'),
        external('e'),
        frameNodecore
      ]
    }]
  })

  pipeline([
    barrierNodeRoot,
    barrierNodeParentUser,
    barrierNodeParentExternal,
    barrierNodeParentBoth
  ], function (err, names) {
    if (err) return t.error(err)

    t.same(names, [
      'miscellaneous',
      'setImmediate',
      '... > c > d > e',
      'setImmediate + ... > c > d > e'
    ])
    t.end()
  })

  function external (name) {
    return {
      functionName: 'external',
      isToplevel: true,
      fileName: `/node_modules/${name}/index.js`,
      lineNumber: 10
    }
  }
})

test('Barrier Node - set long name', function (t) {
  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2],
    isWrapper: true,
    nodes: [{
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2, 3, 4, 5, 6],
      isRoot: true
    }]
  })

  const barrierNodeManyNodesOneType = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }, {
      aggregateId: 3,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }, {
      aggregateId: 4,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }, {
      aggregateId: 6,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }]
  })

  const barrierNodeManyNodesManyTypes = new FakeBarrierNode({
    barrierId: 2,
    parentBarrierId: 1,
    children: [],
    isWrapper: true,
    nodes: [{
      aggregateId: 2,
      parentAggregateId: 1,
      children: [],
      type: 'Immediate',
      frames: []
    }, {
      aggregateId: 3,
      parentAggregateId: 1,
      children: [],
      type: 'TickObject',
      frames: []
    }, {
      aggregateId: 4,
      parentAggregateId: 1,
      children: [],
      type: 'Timeout',
      frames: []
    }, {
      aggregateId: 5,
      parentAggregateId: 1,
      children: [],
      type: 'HTTPPARSER',
      frames: []
    }, {
      aggregateId: 6,
      parentAggregateId: 1,
      children: [],
      type: 'TCPWRAP',
      frames: []
    }]
  })

  pipeline([
    barrierNodeRoot,
    barrierNodeManyNodesOneType
  ], function (err, names) {
    if (err) return t.error(err)

    t.same(names, [
      'miscellaneous',
      'setImmediate'
    ])

    pipeline([
      barrierNodeRoot,
      barrierNodeManyNodesManyTypes
    ], function (err, names) {
      if (err) return t.error(err)

      t.same(names, [
        'miscellaneous',
        'setImmediate + nextTick + timeout + http + ...'
      ])

      t.end()
    })
  })
})

test('Barrier Node - http server', function (t) {
  const nodes = createNodes([
    'TCPSERVERWRAP',
    'HTTPPARSER'
  ])

  pipeline(nodes, function (err, names) {
    if (err) return t.error(err)
    t.same(names, [
      'http.server', // root swaps with http server child
      'http.server',
      'http'
    ])
    t.end()
  })
})

test('Barrier Node - http server with connection', function (t) {
  const nodes = createNodes([
    'TCPSERVERWRAP',
    'TCPWRAP',
    'HTTPPARSER',
    'WRITEWRAP'
  ])

  pipeline(nodes, function (err, names) {
    if (err) return t.error(err)
    t.same(names, [
      'http.server', // root swaps with http server child
      'http.server',
      'http.connection',
      'http',
      'http.connection.write'
    ])
    t.end()
  })
})

test('Barrier Node - tcp server', function (t) {
  const nodes = createNodes([
    'TCPSERVERWRAP',
    'TCPWRAP',
    'WRITEWRAP'
  ])

  pipeline(nodes, function (err, names) {
    if (err) return t.error(err)
    t.same(names, [
      'server', // root swaps with http server child
      'server',
      'connection',
      'connection.write'
    ])
    t.end()
  })
})

test('Barrier Node - http connect', function (t) {
  const nodes = createNodes([
    'TCPCONNECTWRAP',
    'HTTPPARSER',
    'WRITEWRAP'
  ])

  pipeline(nodes, function (err, names) {
    if (err) return t.error(err)
    t.same(names, [
      'miscellaneous',
      'http.connection.connect',
      'http',
      'http.connection.write'
    ])
    t.end()
  })
})

test('Barrier Node - simple types', function (t) {
  pipeline(createNodes(['FSREQWRAP']), function (err, names) {
    if (err) return t.error(err)
    t.same(names, [
      'miscellaneous',
      'fs'
    ])
    pipeline(createNodes(['PROMISE']), function (err, names) {
      if (err) return t.error(err)
      t.same(names, [
        'miscellaneous',
        'promise'
      ])
      pipeline(createNodes(['RANDOMBYTESREQUEST']), function (err, names) {
        if (err) return t.error(err)
        t.same(names, [
          'miscellaneous',
          'random-bytes'
        ])
        t.end()
      })
    })
  })
})

function createNodes (types) {
  let barrierId = 1
  const barrierNodeRoot = new FakeBarrierNode({
    barrierId: 1,
    parentBarrierId: 0,
    children: [2],
    isWrapper: true,
    nodes: [{
      isRoot: true,
      aggregateId: 1,
      parentAggregateId: 0,
      children: [2],
      frames: []
    }]
  })

  const children = types.map(function (type, i) {
    const lastOne = i === types.length - 1
    const node = new FakeBarrierNode({
      barrierId: barrierId + 1,
      parentBarrierId: barrierId,
      children: lastOne ? [] : [barrierId + 2],
      isWrapper: true,
      nodes: [{
        aggregateId: barrierId + 1,
        parentAggregateId: barrierId,
        children: lastOne ? [] : [barrierId + 2],
        type: type,
        frames: []
      }]
    })

    barrierId++
    return node
  })

  return [barrierNodeRoot, ...children]
}

function pipeline (nodes, cb) {
  const systemInfo = new FakeSystemInfo('/')
  startpoint(nodes, { objectMode: true })
    .pipe(new NameBarrierNodes(systemInfo))
    .pipe(endpoint({ objectMode: true }, function (err, barrierNodesOutput) {
      if (err) return cb(err)
      const names = barrierNodesOutput.map(node => node.name)
      cb(null, names)
    }))
}
