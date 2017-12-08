'use strict'

const test = require('tap').test
const path = require('path')
const http = require('http')
const async = require('async')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')
const analysis = require('../analysis/index.js')

function runServer (name, callback) {
  const serverPath = path.resolve(__dirname, 'servers', name + '.js')
  const cmd = new CollectAndRead(serverPath)

  // make two requests
  setTimeout(function () {
    async.map(
      [0, 1],
      function makeRequest (requestId, done) {
        http.get('http://127.0.0.1:18353', function (res) {
          res.pipe(endpoint(done))
        })
      },
      function (err) {
        if (err) return callback(err)
      }
    )
  }, 200)

  // await result
  cmd.on('error', callback)
  cmd.on('ready', function (stackTraceReader, traceEventsReader) {
    analysis(stackTraceReader, traceEventsReader)
      .pipe(endpoint({ objectMode: true }, callback))
  })
}

test('basis server aggregates HTTPPARSER', function (t) {
  runServer('basic', function (err, nodes) {
    if (err) return t.ifError(err)

    const httpParserNodes = nodes.filter(function (aggregateNode) {
      return aggregateNode.sources[0].type === 'HTTPPARSER'
    })

    // HTTPPARSER can have different stacks, because it was either new or
    // a cached HTTPPARSER. Check that these two cases are aggregated into
    // one node.
    t.strictEqual(httpParserNodes.length, 1)
    t.end()
  })
})
