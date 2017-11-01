'use strict'

function getLoggingDirname (pid) {
  return `${pid}.clinic-bubbleprof`
}

module.exports = getLoggingDirname
