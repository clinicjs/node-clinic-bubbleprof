'use strict'

const path = require('path')

function getLoggingPaths (idendifier) {
  const dirname = `${idendifier}.clinic-bubbleprof`
  const stackTraceFilename = `${idendifier}.clinic-bubbleprof-stacktrace`
  const traceEventFilename = `${idendifier}.clinic-bubbleprof-traceevent`

  return {
    '/': dirname,
    '/stacktrace': path.join(dirname, stackTraceFilename),
    '/traceevent': path.join(dirname, traceEventFilename)
  }
}

module.exports = getLoggingPaths
