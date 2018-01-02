'use strict'

const path = require('path')

function getLoggingPaths (options) {
  let dirpath, basename
  if (options.hasOwnProperty('identifier')) {
    dirpath = ''
    basename = options.identifier.toString()
  } else if (options.hasOwnProperty('path')) {
    dirpath = path.dirname(options.path)
    basename = path.basename(options.path, '.clinic-bubbleprof')
  } else {
    throw new Error('missing either identifier or path value')
  }

  const dirname = `${basename}.clinic-bubbleprof`
  const systemInfoFilename = `${basename}.clinic-bubbleprof-systeminfo`
  const stackTraceFilename = `${basename}.clinic-bubbleprof-stacktrace`
  const traceEventFilename = `${basename}.clinic-bubbleprof-traceevent`

  return {
    '/': path.join(dirpath, dirname),
    '/systeminfo': path.join(dirpath, dirname, systemInfoFilename),
    '/stacktrace': path.join(dirpath, dirname, stackTraceFilename),
    '/traceevent': path.join(dirpath, dirname, traceEventFilename)
  }
}

module.exports = getLoggingPaths
