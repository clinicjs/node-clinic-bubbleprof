'use strict'

const fs = require('fs')
const test = require('tap').test
const async = require('async')
const ClinicBubbleprof = require('../index.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventsDecoder = require('../format/trace-events-decoder.js')
const getLoggingPaths = require('../collect/get-logging-paths.js')

function collect (tool, callback) {
  tool.collect(
    [process.execPath, '-e', 'setTimeout(() => {}, 200)'],
    function (err, dirname) {
      if (err) return callback(err, dirname, null)

      const files = getLoggingPaths(dirname.split('.')[0])

      async.parallel({
        stackTraces (done) {
          const stackTraces = []
          fs.createReadStream(files['/stacktrace'])
            .pipe(new StackTraceDecoder())
            .on('data', function (data) {
              stackTraces.push(data)
            })
            .once('end', function () {
              // remove datafile
              fs.unlink(files['/stacktrace'], function (err) {
                if (err) return done(err)
                done(null, stackTraces)
              })
            })
        },
        traveEvents (done) {
          const traceEvents = []
          fs.createReadStream(files['/traceevents'])
            .pipe(new TraceEventsDecoder())
            .on('data', function (data) {
              traceEvents.push(data)
            })
            .once('end', function () {
              // remove datafile
              fs.unlink(files['/traceevents'], function (err) {
                if (err) return done(err)
                done(null, traceEvents)
              })
            })
        }
      }, function (err, output) {
        if (err) return callback(err, dirname, null)

        fs.rmdir(files['/'], function (err) {
          callback(err, dirname, output)
        })
      })
    }
  )
}

test('default collect command', function (t) {
  const tool = new ClinicBubbleprof()
  collect(tool, function (err, dirname, output) {
    t.ifError(err)
    t.ok(dirname.match(/^[0-9]+\.clinic-bubbleprof$/),
         'dirname is correct')

    // find tracked asyncIds
    const trackedAsyncIds = new Set(output.stackTraces.map(
      (stackTrace) => stackTrace.asyncId
    ))

    // find traceEvents for tracked asyncIds
    const traceEvents = new Map()
    for (const traceEvent of output.traveEvents) {
      if (trackedAsyncIds.has(traceEvent.asyncId)) {
        if (!traceEvents.has(traceEvent.asyncId)) {
          traceEvents.set(traceEvent.asyncId, [traceEvent])
        } else {
          traceEvents.get(traceEvent.asyncId).push(traceEvent)
        }
      }
    }

    // Expect all tracked asyncIds to be found in traceEvents
    t.strictDeepEqual(
      Array.from(trackedAsyncIds.keys()).sort(),
      Array.from(traceEvents.keys()).sort()
    )

    // Get async operation types
    const asyncOperationTypes = []
    for (const trackedTraceEvents of traceEvents.values()) {
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
