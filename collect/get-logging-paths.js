'use strict'

const path = require('path')

function getLoggingPaths (idendifier) {
  const dirname = `${idendifier}.clinic-bubbleprof`
  const stackTraceFilename = `${idendifier}.clinic-bubbleprof-stacktrace`
  const traceEventsFilename = `${idendifier}.clinic-bubbleprof-traceevents`

  return {
    '/': dirname,
    '/stacktrace': path.join(dirname, stackTraceFilename),
    '/traceevents': path.join(dirname, traceEventsFilename)
  }
}

module.exports = getLoggingPaths
