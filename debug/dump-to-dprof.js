'use strict'
const fs = require('fs')
const path = require('path')
const getLoggingPaths = require('../collect/get-logging-paths.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventsDecoder = require('../format/trace-events-decoder.js')
const analysis = require('../analysis/index.js')
const AggregateNodesToDprof = require('./aggregate-nodes-to-dprof.js')

// Load data
const pid = path.basename(process.argv[2], '.clinic-bubbleprof')
const paths = getLoggingPaths(pid)
const stackTraceReader = fs.createReadStream(paths['/stacktrace'])
  .pipe(new StackTraceDecoder())
const traceEventsReader = fs.createReadStream(paths['/traceevents'])
  .pipe(new TraceEventsDecoder())

// create dataFile
analysis(stackTraceReader, traceEventsReader)
  .pipe(new AggregateNodesToDprof())
  .pipe(process.stdout)
