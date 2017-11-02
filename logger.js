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
let skipThis = false
const skipAsyncIds = new Set()
const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    // Save the asyncId such nested async operations can be skiped later.
    if (skipThis) return skipAsyncIds.add(asyncId)
    // This is a nested async operations, skip this and track futher nested
    // async operations.
    if (skipAsyncIds.has(triggerAsyncId)) return skipAsyncIds.add(asyncId)

    // Track async events that comes from this async operation
    skipThis = true
    encoder.write({
      asyncId: asyncId,
      frames: stackTrace()
    })
    skipThis = false
  },

  destroy (asyncId) {
    skipAsyncIds.delete(asyncId)
  }
})
hook.enable()

// before process exits, flush the encoded data to the sample file
process.once('beforeexit', function () {
  hook.disable()
  encoder.end()
})
