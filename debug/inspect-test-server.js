'use strict'

const path = require('path')
const async = require('async')
const CollectAndRead = require('../test/collect-and-read.js')
const inspectpoint = require('inspectpoint')
const analysis = require('../analysis/index.js')

function runServer (name) {
  const serverPath = path.resolve(__dirname, '..', 'test', 'servers', name + '.js')
  const cmd = new CollectAndRead({}, serverPath)

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
      .pipe(inspectpoint({ depth: null, colors: true }))
      .pipe(process.stdout)
  })
}

runServer(process.argv[2])
