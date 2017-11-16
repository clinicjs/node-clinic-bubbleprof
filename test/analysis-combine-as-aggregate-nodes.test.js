'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const SourceNode = require('../analysis/source-node.js')
const CombineAsAggregateNodes = require('../analysis/combine-as-aggregate-nodes.js')

test('join raw events order', function (t) {
  const serverNode = new SourceNode(2)
  serverNode.setIdentifier('server.js')
  serverNode.addStackTrace({
    asyncId: 2,
    frames: [{ fileName: 'server.js' }]
  })
  serverNode.addTraceEvent({
    event: 'init',
    type: 'SERVER',
    asyncId: 2,
    triggerAsyncId: 1,
    timestamp: 1
  })
  serverNode.addTraceEvent({
    event: 'destroy',
    asyncId: 2,
    timestamp: 10
  })

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
    socketNode.addStackTrace({
      asyncId: socketAsyncId,
      frames: [{ fileName: 'server.js' }]
    })
    socketNode.addTraceEvent({
      event: 'init',
      type: 'SOCKET',
      asyncId: socketAsyncId,
      triggerAsyncId: 2,
      timestamp: 2 + i * 2
    })
    socketNode.addTraceEvent({
      event: 'destroy',
      asyncId: socketAsyncId,
      timestamp: 4 + i * 2
    })

    const logNode = new SourceNode(logAsyncId)
    logNodes.push(logNode)
    logNode.setIdentifier('log.js')
    logNode.addStackTrace({
      asyncId: logAsyncId,
      frames: [{ fileName: 'log.js' }]
    })
    logNode.addTraceEvent({
      event: 'init',
      type: 'LOG',
      asyncId: logAsyncId,
      triggerAsyncId: socketAsyncId,
      timestamp: 3 + i * 2
    })
    logNode.addTraceEvent({
      event: 'destroy',
      asyncId: logAsyncId,
      timestamp: 4 + i * 2
    })

    const endNode = new SourceNode(endAsyncId)
    endNodes.push(endNode)
    endNode.setIdentifier('server.js')
    endNode.addStackTrace({
      asyncId: endAsyncId,
      frames: [{ fileName: 'server.js' }]
    })
    endNode.addTraceEvent({
      event: 'init',
      type: 'END',
      asyncId: endAsyncId,
      triggerAsyncId: socketAsyncId,
      timestamp: 3 + i * 2
    })
    endNode.addTraceEvent({
      event: 'destroy',
      asyncId: endAsyncId,
      timestamp: 4 + i * 2
    })
  }

  const sourceNodes = [serverNode, ...socketNodes, ...logNodes, ...endNodes]
  startpoint(sourceNodes, { objectMode: true })
    .pipe(new CombineAsAggregateNodes())
    .pipe(endpoint({ objectMode: true }, function (err, data) {
      if (err) return t.ifError(err)

      // remove constructor from object
      const aggregateNodes = data.map(
        (aggregateNode) => Object.assign({}, aggregateNode)
      )

      // root
      t.strictDeepEqual(aggregateNodes[0], {
        nodeId: 1,
        parentNodeId: 0,
        children: [ 2 ],
        sources: [ aggregateNodes[0].sources[0] ]
      })

      // server
      t.strictDeepEqual(aggregateNodes[1], {
        nodeId: 2,
        parentNodeId: 1,
        children: [ 3 ],
        sources: [ serverNode ]
      })

      // socket
      t.strictDeepEqual(aggregateNodes[2], {
        nodeId: 3,
        parentNodeId: 2,
        children: [ 4, 5 ],
        sources: socketNodes
      })

      // log
      t.strictDeepEqual(aggregateNodes[3], {
        nodeId: 4,
        parentNodeId: 3,
        children: [ ],
        sources: logNodes
      })

      // end
      t.strictDeepEqual(aggregateNodes[4], {
        nodeId: 5,
        parentNodeId: 3,
        children: [ ],
        sources: endNodes
      })

      t.end()
    }))
})
