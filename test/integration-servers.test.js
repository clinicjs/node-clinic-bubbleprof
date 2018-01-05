'use strict'

const test = require('tap').test
const path = require('path')
const async = require('async')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')
const analysis = require('../analysis/index.js')

function runServer (name, callback) {
  const serverPath = path.resolve(__dirname, 'servers', name + '.js')
  const cmd = new CollectAndRead({}, serverPath)

  // make two requests
  async.map(
    [0, 1],
    function makeRequest (requestId, done) {
      cmd.request('/', done)
    },
    function (err) {
      if (err) return callback(err)
    }
  )

  // await result
  cmd.on('error', callback)
  cmd.on('ready', function (systemInfoReader, stackTraceReader, traceEventReader) {
    analysis(systemInfoReader, stackTraceReader, traceEventReader)
      .pipe(endpoint({ objectMode: true }, callback))
  })
}

test('basis server aggregates HTTPPARSER', function (t) {
  runServer('basic', function (err, nodes) {
    if (err) return t.ifError(err)

    // Get AggregateNodes from BarrierNodes
    const aggregateNodes = [].concat(
      ...nodes.map((barrierNode) => barrierNode.nodes)
    )

    const httpParserNodes = aggregateNodes.filter(function (aggregateNode) {
      return aggregateNode.sources[0].type === 'HTTPPARSER'
    })

    // HTTPPARSER can have different stacks, because it was either new or
    // a cached HTTPPARSER. Check that these two cases are aggregated into
    // one node.
    t.strictEqual(httpParserNodes.length, 1)
    t.end()
  })
})
