'use strict'
const fs = require('fs')
const getLoggingPaths = require('../collect/get-logging-paths.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventDecoder = require('../format/trace-event-decoder.js')
const analysis = require('../analysis/index.js')
const AggregateNodesToDprof = require('./aggregate-nodes-to-dprof.js')

// Load data
const paths = getLoggingPaths({ path: process.argv[2] })
const stackTraceReader = fs.createReadStream(paths['/stacktrace'])
  .pipe(new StackTraceDecoder())
const traceEventReader = fs.createReadStream(paths['/traceevent'])
  .pipe(new TraceEventDecoder())

// create dataFile
analysis(stackTraceReader, traceEventReader)
  .pipe(new AggregateNodesToDprof())
  .pipe(process.stdout)
