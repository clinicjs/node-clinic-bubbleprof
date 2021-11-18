'use strict'

const test = require('tap').test
const path = require('path')
const async = require('async')
const semver = require('semver')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')
const analysis = require('../analysis/index.js')

const skipHTTPPARSER = semver.gte(process.version, '12.0.0')
  ? 'Node 12 uses a new http parser that does not generate HTTPPARSER aggregate nodes'
  : false

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

test('basic server aggregates HTTPPARSER', { skip: skipHTTPPARSER }, function (t) {
  runServer('basic', function (err, nodes) {
    if (err) return t.error(err)

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
    t.equal(httpParserNodes.length, 1)
    t.end()
  })
})

test('latency server has http.connection.end cluster', { skip: skipHTTPPARSER }, function (t) {
  runServer('latency', function (err, nodes) {
    if (err) return t.error(err)

    const endName = nodes.some(c => c.name.includes('http.connection.end'))
    t.ok(endName, 'has http.connection.end name')
    t.end()
  })
})
