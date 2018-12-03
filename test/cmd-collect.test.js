'use strict'

const test = require('tap').test
const async = require('async')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')

test('collect command produces data files with content', function (t) {
  const cmd = new CollectAndRead({}, '-e', 'setTimeout(() => {}, 200)')
  cmd.on('error', t.ifError.bind(t))
  cmd.on('ready', function (systemInfoReader, stackTraceReader, traceEventReader) {
    async.parallel({
      systemInfo (done) {
        // collect tracked asyncIds
        systemInfoReader
          .pipe(endpoint({ objectMode: true }, function (err, data) {
            if (err) return done(err)

            done(null, data[0])
          }))
      },

      stackTrace (done) {
        // collect tracked asyncIds
        stackTraceReader
          .pipe(endpoint({ objectMode: true }, function (err, data) {
            if (err) return done(err)

            const stackTraceMap = new Map()
            for (const stackTrace of data) {
              stackTraceMap.set(stackTrace.asyncId, stackTrace)
            }

            done(null, stackTraceMap)
          }))
      },

      traceEvent (done) {
        // collect traceEvent for all asyncIds
        traceEventReader
          .pipe(endpoint({ objectMode: true }, function (err, data) {
            if (err) return done(err)

            const traceEventMap = new Map()
            for (const traceEvent of data) {
              if (!traceEventMap.has(traceEvent.asyncId)) {
                traceEventMap.set(traceEvent.asyncId, [])
              }
              traceEventMap.get(traceEvent.asyncId).push(traceEvent)
            }

            done(null, traceEventMap)
          }))
      }
    }, function (err, output) {
      if (err) return t.ifError(err)

      // filter untracked events out
      for (const asyncId of output.traceEvent.keys()) {
        if (!output.stackTrace.has(asyncId)) {
          output.traceEvent.delete(asyncId)
        }
      }

      // Expect all tracked asyncIds to be found in traceEvent
      t.strictDeepEqual(
        Array.from(output.stackTrace.keys()).sort(),
        Array.from(output.traceEvent.keys()).sort()
      )

      // Get async operation types
      const asyncOperationTypes = []
      for (const trackedTraceEvent of output.traceEvent.values()) {
        asyncOperationTypes.push(trackedTraceEvent[0].type)
      }

      if (process.version.indexOf('v10') >= 0 || process.version.indexOf('v8') >= 0) {
        // Expect Timeout and TIMERWRAP to be there
        t.strictDeepEqual(
          asyncOperationTypes.sort(),
          ['TIMERWRAP', 'Timeout']
        )
      } else {
        // Expect Timeout to be there
        t.strictDeepEqual(
          asyncOperationTypes.sort(),
          ['Timeout']
        )
      }

      t.end()
    })
  })
})
