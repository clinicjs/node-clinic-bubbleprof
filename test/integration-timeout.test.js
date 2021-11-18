'use strict'

const test = require('tap').test
const semver = require('semver')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')
const analysis = require('../analysis/index.js')

test('collect-analysis pipeline', function (t) {
  const cmd = new CollectAndRead({}, '-e', 'setTimeout(() => {}, 200)')
  cmd.on('error', t.error.bind(t))
  cmd.on('ready', function (systemInfoReader, stackTraceReader, traceEventReader) {
    analysis(systemInfoReader, stackTraceReader, traceEventReader)
      .pipe(endpoint({ objectMode: true }, function (err, nodes) {
        if (err) return t.error(err)

        // Get AggregateNodes from BarrierNodes
        const aggregateNodes = [].concat(
          ...nodes.map((barrierNode) => barrierNode.nodes)
        )

        const nodeMap = new Map(
          aggregateNodes.map((node) => [node.aggregateId, node])
        )
        if (semver.satisfies(process.version, '>= 12.16.0 < 12.17.0')) {
          t.equal(nodes.length, 3)
          t.equal(nodeMap.size, 3)
          // aggregateId = 1 is the root and points to the Timeout and a PROMISE from Node.js's initialization code
          t.strictSame(nodeMap.get(1).children, [2, 3])
        } else {
          t.equal(nodes.length, 2)
          t.equal(nodeMap.size, 2)
          // aggregateId = 1 is the root and points to the Timeout
          t.strictSame(nodeMap.get(1).children, [2])
        }

        // aggregateId = 2 is the Timeout
        t.equal(nodeMap.get(2).sources[0].type, 'Timeout')

        t.end()
      }))
  })
})
