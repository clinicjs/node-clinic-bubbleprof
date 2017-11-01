'use strict'

const fs = require('fs')
const path = require('path')
const asyncHooks = require('async_hooks')
const stackTrace = require('./collect/stack-trace.js')
const StackTraceEncoder = require('./format/stack-trace-encoder.js')
const getStackTraceFilename = require('./collect/get-stack-trace-filename.js')

// setup encoded states file
const stackTraceFilepath = path.resolve(getStackTraceFilename(process.pid))
const encoder = new StackTraceEncoder()
encoder.pipe(
  fs.createWriteStream(stackTraceFilepath, {
    // Open log file synchronously to ensure that that .write() only
    // corresponds to one async action. This makes it easy to filter .write()
    // in async_hooks.
    fd: fs.openSync(stackTraceFilepath, 'w')
  })
)

// log stack traces
let skip = false
const hook = asyncHooks.createHook({
  init(asyncId) {
    if (skip) return

    skip = true
    encoder.write({
      asyncId: asyncId,
      frames: stackTrace()
    })
    skip = false
  }
})
hook.enable()

// before process exits, flush the encoded data to the sample file
process.once('beforeexit', function () {
  hook.disable()
  encoder.end()
})
