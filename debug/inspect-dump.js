'use strict'
const fs = require('fs')
const inspectpoint = require('inspectpoint')
const analysis = require('../analysis/index.js')
const getLoggingPaths = require('@clinic/clinic-common').getLoggingPaths('bubbleprof')
const SystemInfoDecoder = require('../format/system-info-decoder.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventDecoder = require('../format/trace-event-decoder.js')

// Load data
const paths = getLoggingPaths({ path: process.argv[2] })
const systemInfoReader = fs.createReadStream(paths['/systeminfo'])
  .pipe(new SystemInfoDecoder())
const stackTraceReader = fs.createReadStream(paths['/stacktrace'])
  .pipe(new StackTraceDecoder())
const traceEventReader = fs.createReadStream(paths['/traceevent'])
  .pipe(new TraceEventDecoder())

// Print data
analysis(systemInfoReader, stackTraceReader, traceEventReader)
  .pipe(inspectpoint({ depth: null, colors: true }))
  .pipe(process.stdout)
