'use strict'

const path = require('path')
const startpoint = require('startpoint')
const inspectpoint = require('inspectpoint')
const { FakeSystemInfo, FakeAggregateNode } = require('./analysis-util')

const WrapAsBarrierNodes = require('../analysis/barrier/wrap-as-barrier-nodes.js')
const MakeExternalBarrierNodes = require('../analysis/barrier/make-external-barrier-nodes.js')
const MakeSynchronousBarrierNodes = require('../analysis/barrier/make-synchronous-barrier-nodes.js')

const CombineAsClusterNodes = require('../analysis/cluster/combine-as-cluster-nodes.js')

function createTreeStructure () {
  const data = [
    new FakeAggregateNode({
      aggregateId: 1,
      parentAggregateId: 0,
      children: [ 10, 11 ],
      isRoot: true,
      frames: []
    }),

    new FakeAggregateNode({
      aggregateId: 10,
      parentAggregateId: 1,
      children: [ 12 ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 },
         { functionName: 'maybeCache',
           typeName: 'Router',
           fileName: '/node_modules/external-server/router.js',
           lineNumber: 436 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 11,
      parentAggregateId: 1,
      children: [ 13 ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 },
         { functionName: 'maybeCache',
           typeName: 'Router',
           fileName: '/node_modules/external-server/router.js',
           lineNumber: 551 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 12,
      parentAggregateId: 10,
      children: [ 14 ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 13,
      parentAggregateId: 11,
      children: [ 15 ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 14,
      parentAggregateId: 12,
      children: [ ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 15,
      parentAggregateId: 13,
      children: [ ],
      type: 'Immediate',
      frames:
       [ { functionName: 'recursiveFunction',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9 } ]
    })
  ]

  return startpoint(data.sort((a, b) => a.aggregateId - b.aggregateId), { objectMode: true })
}

const systemInfo = new FakeSystemInfo('/servers')

createTreeStructure()
  .pipe(new WrapAsBarrierNodes())
  .pipe(new MakeSynchronousBarrierNodes(systemInfo))
  .pipe(new CombineAsClusterNodes())
  .pipe(inspectpoint({ depth: null, colors: true }))
  .pipe(process.stdout)
