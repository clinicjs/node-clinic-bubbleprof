'use strict'

const fs = require('fs')
const asyncHooks = require('async_hooks')
const stackTrace = require('../collect/stack-trace.js')
const systemInfo = require('../collect/system-info.js')
const StackTraceEncoder = require('../format/stack-trace-encoder.js')
const getLoggingPaths = require('../collect/get-logging-paths.js')

// create dirname
const paths = getLoggingPaths({ identifier: process.pid })
fs.mkdirSync(paths['/'])

// write system file
fs.writeFileSync(paths['/systeminfo'], JSON.stringify(systemInfo(), null, 2))

// setup encoded states file
const encoder = new StackTraceEncoder()
encoder.pipe(
  fs.createWriteStream(paths['/stacktrace'], {
    // Open log file synchronously to ensure that that .write() only
    // corresponds to one async action. This makes it easy to filter .write()
    // in async_hooks.
    fd: fs.openSync(paths['/stacktrace'], 'w')
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
      frames: stackTrace(2)
    })
    skipThis = false
  },

  destroy (asyncId) {
    skipAsyncIds.delete(asyncId)
  }
})
hook.enable()

// before process exits, flush the encoded data to the sample file
process.once('beforeExit', function () {
  hook.disable()
  encoder.end()
})

// NOTE: Workaround until https://github.com/nodejs/node/issues/18476 is solved
skipThis = true
process.on('SIGINT', function () {
  if (process.listenerCount('SIGINT') === 1) process.exit(0)
})
skipThis = false
