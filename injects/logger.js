'use strict'

const fs = require('fs')
const makeDir = require('mkdirp')
const asyncHooks = require('async_hooks')
const stackTrace = require('../collect/stack-trace.js')
const systemInfo = require('../collect/system-info.js')
const StackTraceEncoder = require('../format/stack-trace-encoder.js')
const getLoggingPaths = require('@nearform/clinic-common').getLoggingPaths('bubbleprof')

function checkForTranspiledCode (filename) {
  const readFile = fs.readFileSync(filename, 'utf8')
  const regex = /function\s+(?<functionName>\w+)/g
  let matchedObj
  let isTranspiled = false

  // Check for a source map
  isTranspiled = readFile.includes('//# sourceMappingURL=')

  while ((matchedObj = regex.exec(readFile)) !== null) {
    // Avoid infinite loops with zero-width matches
    if (matchedObj.index === regex.lastIndex) {
      regex.lastIndex++
    }
    // Loop through results and check length of fn name
    matchedObj.forEach((match, groupIndex) => {
      if (groupIndex !== 0 && match.length < 3) {
        isTranspiled = true
      }
    })
  }
  return isTranspiled
}

// create dirname
const paths = getLoggingPaths({
  path: process.env.NODE_CLINIC_BUBBLEPROF_DATA_PATH,
  identifier: process.pid
})
makeDir.sync(paths['/'])

// write system file
fs.writeFileSync(paths['/systeminfo'], JSON.stringify(systemInfo(), null, 2))

// setup encoded states file
const encoder = new StackTraceEncoder()
const out = encoder.pipe(
  fs.createWriteStream(paths['/stacktrace'], {
    // Open log file synchronously to ensure that that .write() only
    // corresponds to one async action. This makes it easy to filter .write()
    // in async_hooks.
    fd: fs.openSync(paths['/stacktrace'], 'w')
  })
)

// log stack traces, export a flag to opt out of logging for internals
exports.skipThis = false
const skipAsyncIds = new Set()
let firedOnce = false

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    if (!firedOnce && process.mainModule && checkForTranspiledCode(process.mainModule.filename)) {
      // Show warning to user
      fs.writeSync(3, 'source_warning', null, 'utf8')
      firedOnce = true
    }
    // Save the asyncId such nested async operations can be skiped later.
    if (exports.skipThis) return skipAsyncIds.add(asyncId)
    // This is a nested async operations, skip this and track futher nested
    // async operations.
    if (skipAsyncIds.has(triggerAsyncId)) return skipAsyncIds.add(asyncId)

    // Track async events that comes from this async operation
    exports.skipThis = true
    encoder.write({
      asyncId: asyncId,
      frames: stackTrace(2)
    })
    exports.skipThis = false
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
  out.on('close', function () {
    process.exit()
  })
})

// NOTE: Workaround until https://github.com/nodejs/node/issues/18476 is solved
exports.skipThis = true
process.on('SIGINT', function () {
  if (process.listenerCount('SIGINT') === 1) process.emit('beforeExit')
})
exports.skipThis = false
