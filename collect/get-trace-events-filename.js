'use strict'

function getTraceEventsFilename (pid) {
  return `${pid}.clinic-bubbleprof-traceevents`
}

module.exports = getTraceEventsFilename
