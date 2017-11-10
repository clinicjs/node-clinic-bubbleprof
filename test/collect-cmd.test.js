'use strict'

const test = require('tap').test
const async = require('async')
const CollectAndRead = require('./collect-and-read.js')

test('collect command produces data files with content', function (t) {
  const cmd = new CollectAndRead('-e', 'setTimeout(() => {}, 200)')
  cmd.on('error', t.ifError.bind(t))
  cmd.on('ready', function (stackTraceReader, traceEventsReader) {

    async.parallel({
      stackTrace(done) {
        // collect tracked asyncIds
        const stackTraceMap = new Map()
        stackTraceReader
          .on('data', function (stackTrace) {
            stackTraceMap.set(stackTrace.asyncId, stackTrace)
          })
          .on('error', done)
          .on('end', function () {
            done(null, stackTraceMap)
          })
      },

      traceEvents(done) {
        // collect traceEvents for all asyncIds
        const traceEventsMap = new Map()
        traceEventsReader
          .on('data', function (traceEvent) {
            if (!traceEventsMap.has(traceEvent.asyncId)) {
              traceEventsMap.set(traceEvent.asyncId, [])
            }
            traceEventsMap.get(traceEvent.asyncId).push(traceEvent)
          })
          .on('error', done)
          .on('end', function () {
            done(null, traceEventsMap)
          })
      }
    }, function (err, output) {
      // filter untracked events out
      for (const asyncId of output.traceEvents.keys()) {
        if (!output.stackTrace.has(asyncId)) {
          output.traceEvents.delete(asyncId)
        }
      }

      // Expect all tracked asyncIds to be found in traceEvents
      t.strictDeepEqual(
        Array.from(output.stackTrace.keys()).sort(),
        Array.from(output.traceEvents.keys()).sort()
      )

      // Get async operation types
      const asyncOperationTypes = []
      for (const trackedTraceEvents of output.traceEvents.values()) {
        asyncOperationTypes.push(trackedTraceEvents[0].type)
      }

      // Expect Timeout and TIMERWRAP to be there
      t.strictDeepEqual(
        asyncOperationTypes.sort(),
        ['TIMERWRAP', 'Timeout']
      )

      t.end()
    })
  })
})
