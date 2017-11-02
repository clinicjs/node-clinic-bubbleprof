'use strict'

const path = require('path')
const getStackTraceFilename = require('./get-stack-trace-filename.js')
const getTraceEventsFilename = require('./get-trace-events-filename.js')

function getLoggingFiles (dirname) {
  const pid = parseInt(dirname.split('.')[0], 10)

  return {
    stackTrace: path.join(dirname, getStackTraceFilename(pid)),
    traceEvents: path.join(dirname, getTraceEventsFilename(pid))
  }
}

module.exports = getLoggingFiles
