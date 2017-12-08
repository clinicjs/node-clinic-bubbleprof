'use strict'

const path = require('path')
const http = require('http')
const async = require('async')
const endpoint = require('endpoint')
const CollectAndRead = require('../test/collect-and-read.js')
const analysis = require('../analysis/index.js')
const AggregateNodesToDprof = require('./aggregate-nodes-to-dprof.js')

function runServer (name) {
  const serverPath = path.resolve(__dirname, '..', 'test', 'servers', name + '.js')
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
        if (err) throw err
      }
    )
  }, 200)

  // await result
  cmd.on('ready', function (stackTraceReader, traceEventsReader) {
    analysis(stackTraceReader, traceEventsReader)
      .pipe(new AggregateNodesToDprof())
      .pipe(process.stdout)
  })
}

runServer(process.argv[2])
