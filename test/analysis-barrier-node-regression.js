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
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { functionName: 'onRoute',
           isToplevel: true,
           fileName: '/node_modules/restify/lib/server.js',
           lineNumber: 939,
           columnNumber: 24 },
         { functionName: 'find',
           typeName: 'Router',
           fileName: '/node_modules/restify/lib/router.js',
           lineNumber: 436,
           columnNumber: 9 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 11,
      parentAggregateId: 1,
      children: [ 13 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { functionName: 'onRoute',
           isToplevel: true,
           fileName: '/node_modules/restify/lib/server.js',
           lineNumber: 939,
           columnNumber: 24 },
         { functionName: 'find',
           typeName: 'Router',
           fileName: '/node_modules/restify/lib/router.js',
           lineNumber: 551,
           columnNumber: 9 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 12,
      parentAggregateId: 10,
      children: [ 14 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 13,
      parentAggregateId: 11,
      children: [ 15 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 14,
      parentAggregateId: 12,
      children: [ 16 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 15,
      parentAggregateId: 13,
      children: [ 17 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 16,
      parentAggregateId: 14,
      children: [ 18 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 17,
      parentAggregateId: 15,
      children: [ 19 ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 18,
      parentAggregateId: 16,
      children: [ ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
    }),

    new FakeAggregateNode({
      aggregateId: 19,
      parentAggregateId: 17,
      children: [ ],
      mark: [ 'user', null, null ],
      type: 'Immediate',
      frames:
       [ { functionName: 'createLargeLinkStructure',
           isToplevel: true,
           fileName: '/servers/bug.js',
           lineNumber: 9,
           columnNumber: 3 },
         { typeName: 'Immediate',
           fileName: '/servers/bug.js',
           lineNumber: 13,
           columnNumber: 7 } ]
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
