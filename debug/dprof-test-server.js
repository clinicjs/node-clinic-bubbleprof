'use strict'

const path = require('path')
const async = require('async')
const CollectAndRead = require('../test/collect-and-read.js')
const analysis = require('../analysis/index.js')
const AggregateNodesToDprof = require('./aggregate-nodes-to-dprof.js')

function runServer (name) {
  const serverPath = path.resolve(__dirname, '..', 'test', 'servers', name + '.js')
  const cmd = new CollectAndRead(serverPath)

  // make two requests
  async.map(
    [0, 1],
    function makeRequest (requestId, done) {
      cmd.request('/', done)
    },
    function (err) {
      if (err) throw err
    }
  )

  // await result
  cmd.on('ready', function (systemInfoReader, stackTraceReader, traceEventReader) {
    analysis(systemInfoReader, stackTraceReader, traceEventReader)
      .on('data', (data) => console.log(require('util').inspect(data, { colors: true, depth: 4 })))
      //.pipe(new AggregateNodesToDprof())
      //.pipe(process.stdout)
  })
}

runServer(process.argv[2])
