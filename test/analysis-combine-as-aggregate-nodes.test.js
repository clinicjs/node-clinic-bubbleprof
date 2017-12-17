'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const SourceNode = require('../analysis/source/source-node.js')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const TraceEvent = require('../analysis/trace-event/trace-event.js')
const CombineAsAggregateNodes = require('../analysis/aggregate/combine-as-aggregate-nodes.js')

test('join raw events order', function (t) {
  const serverNode = new SourceNode(2)
  serverNode.setIdentifier('server.js')
  serverNode.addStackTrace(new StackTrace({
    asyncId: 2,
    frames: [{ fileName: 'server.js' }]
  }))
  serverNode.addTraceEvent(new TraceEvent({
    event: 'init',
    type: 'SERVER',
    asyncId: 2,
    triggerAsyncId: 1,
    timestamp: 1
  }))
  serverNode.addTraceEvent(new TraceEvent({
    event: 'destroy',
    asyncId: 2,
    timestamp: 10
  }))

  const socketNodes = []
  const logNodes = []
  const endNodes = []
  for (let i = 0; i < 2; i++) {
    const socketAsyncId = 3 + i * 3
    const logAsyncId = 4 + i * 3
    const endAsyncId = 5 + i * 3

    const socketNode = new SourceNode(socketAsyncId)
    socketNodes.push(socketNode)
    socketNode.setIdentifier('server.js')
    socketNode.addStackTrace(new StackTrace({
      asyncId: socketAsyncId,
      frames: [{ fileName: 'server.js' }]
    }))
    socketNode.addTraceEvent(new TraceEvent({
      event: 'init',
      type: 'SOCKET',
      asyncId: socketAsyncId,
      triggerAsyncId: 2,
      timestamp: 2 + i * 2
    }))
    socketNode.addTraceEvent(new TraceEvent({
      event: 'destroy',
      asyncId: socketAsyncId,
      timestamp: 4 + i * 2
    }))

    const logNode = new SourceNode(logAsyncId)
    logNodes.push(logNode)
    logNode.setIdentifier('log.js')
    logNode.addStackTrace(new StackTrace({
      asyncId: logAsyncId,
      frames: [{ fileName: 'log.js' }]
    }))
    logNode.addTraceEvent(new TraceEvent({
      event: 'init',
      type: 'LOG',
      asyncId: logAsyncId,
      triggerAsyncId: socketAsyncId,
      timestamp: 3 + i * 2
    }))
    logNode.addTraceEvent(new TraceEvent({
      event: 'destroy',
      asyncId: logAsyncId,
      timestamp: 4 + i * 2
    }))

    const endNode = new SourceNode(endAsyncId)
    endNodes.push(endNode)
    endNode.setIdentifier('server.js')
    endNode.addStackTrace(new StackTrace({
      asyncId: endAsyncId,
      frames: [{ fileName: 'server.js' }]
    }))
    endNode.addTraceEvent(new TraceEvent({
      event: 'init',
      type: 'END',
      asyncId: endAsyncId,
      triggerAsyncId: socketAsyncId,
      timestamp: 3 + i * 2
    }))
    endNode.addTraceEvent(new TraceEvent({
      event: 'destroy',
      asyncId: endAsyncId,
      timestamp: 4 + i * 2
    }))
  }

  const sourceNodes = [serverNode, ...socketNodes, ...logNodes, ...endNodes]
  startpoint(sourceNodes, { objectMode: true })
    .pipe(new CombineAsAggregateNodes())
    .pipe(endpoint({ objectMode: true }, function (err, aggregateNodes) {
      if (err) return t.ifError(err)

      // root
      t.strictDeepEqual(aggregateNodes[0].toJSON(), {
        aggregateId: 1,
        parentAggregateId: 0,
        children: [ 2 ],
        sources: [ aggregateNodes[0].sources[0].toJSON({ short: true }) ],
        mark: ['root', null, null],
        type: null,
        frames: []
      })

      // server
      t.strictDeepEqual(aggregateNodes[1].toJSON(), {
        aggregateId: 2,
        parentAggregateId: 1,
        children: [ 3 ],
        sources: [ serverNode.toJSON({ short: true }) ],
        mark: [null, null, null],
        type: 'SERVER',
        frames: [{ fileName: 'server.js' }]
      })

      // socket
      t.strictDeepEqual(aggregateNodes[2].toJSON(), {
        aggregateId: 3,
        parentAggregateId: 2,
        children: [ 4, 5 ],
        sources: socketNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        type: 'SOCKET',
        frames: [{ fileName: 'server.js' }]
      })

      // log
      t.strictDeepEqual(aggregateNodes[3].toJSON(), {
        aggregateId: 4,
        parentAggregateId: 3,
        children: [ ],
        sources: logNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        type: 'LOG',
        frames: [{ fileName: 'log.js' }]
      })

      // end
      t.strictDeepEqual(aggregateNodes[4].toJSON(), {
        aggregateId: 5,
        parentAggregateId: 3,
        children: [ ],
        sources: endNodes.map((source) => source.toJSON({ short: true })),
        mark: [null, null, null],
        type: 'END',
        frames: [{ fileName: 'server.js' }]
      })

      t.end()
    }))
})
