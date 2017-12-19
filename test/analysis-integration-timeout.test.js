'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')
const analysis = require('../analysis/index.js')

test('collect-analysis pipeline', function (t) {
  const cmd = new CollectAndRead('-e', 'setTimeout(() => {}, 200)')
  cmd.on('error', t.ifError.bind(t))
  cmd.on('ready', function (stackTraceReader, traceEventReader) {
    analysis(stackTraceReader, traceEventReader)
      .pipe(endpoint({ objectMode: true }, function (err, nodes) {
        if (err) return t.ifError(err)

        const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]))
        t.strictEqual(nodes.length, 2)
        t.strictEqual(nodeMap.size, 2)

        // nodeId = 1 is the root and points to the Timeout
        t.strictDeepEqual(nodeMap.get(1).children, [ 2 ])
        // nodeId = 2 is the Timeout
        t.strictEqual(nodeMap.get(2).sources[0].type, 'Timeout')

        t.end()
      }))
  })
})
