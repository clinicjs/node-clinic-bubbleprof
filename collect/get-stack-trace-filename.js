'use strict'

function getStackTraceFilename (pid) {
  return `${pid}.clinic-bubbleprof-stacktrace`
}

module.exports = getStackTraceFilename
