'use strict'

const test = require('tap').test
const async = require('async')
const endpoint = require('endpoint')
const semver = require('semver')
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

      const expected =
        // Expect Timeout and TIMERWRAP to be there in Node 10.x and below. TIMERWRAP was removed in https://github.com/nodejs/node/pull/20894
        semver.satisfies(process.version, '< 11.0')
          ? ['TIMERWRAP', 'Timeout']
        // A `Promise.resolve()` call was added to bootstrap code in Node 12.16.x: https://github.com/nodejs/node/pull/30624
        // Node.js 12.17.0 does not appear to show this `resolve()` call in its trace event log.
          : semver.satisfies(process.version, '>= 12.16.0 < 12.17.0')
            ? ['PROMISE', 'Timeout']
            : ['Timeout']

      t.strictDeepEqual(asyncOperationTypes.sort(), expected)

      t.end()
    })
  })
})
