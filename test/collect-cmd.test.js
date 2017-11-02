'use strict'

const fs = require('fs')
const test = require('tap').test
const async = require('async')
const ClinicBubbleprof = require('../index.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const getLoggingFiles = require('../collect/get-logging-files.js')

function collect (tool, callback) {
  tool.collect(
    [process.execPath, '-e', 'setTimeout(() => {}, 200)'],
    function (err, dirname) {
      if (err) return callback(err, dirname, null)

      const files = getLoggingFiles(dirname)

      async.parallel({
        stackTraces (done) {
          const stackTraces = []
          fs.createReadStream(files.stackTrace)
            .pipe(new StackTraceDecoder())
            .on('data', function (data) {
              stackTraces.push(data)
            })
            .once('end', function () {
              // remove datafile
              fs.unlink(files.stackTrace, function (err) {
                if (err) return done(err)
                done(null, stackTraces)
              })
            })
        },
        traveEvents (done) {
          fs.readFile(files.traceEvents, function (err, content) {
            if (err) return done(err)

            // remove datafile
            fs.unlink(files.traceEvents, function (err) {
              if (err) return done(err)
              done(null, JSON.parse(content).traceEvents)
            })
          })
        }
      }, function (err, output) {
        if (err) return callback(err, dirname, null)

        fs.rmdir(dirname, function (err) {
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
      const asyncId = parseInt(traceEvent.id, 16)
      if (trackedAsyncIds.has(asyncId)) {
        if (!traceEvents.has(asyncId)) traceEvents.set(asyncId, [])
        traceEvents.get(asyncId).push(traceEvent)
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
      asyncOperationTypes.push(trackedTraceEvents[0].name)
    }

    // Expect Timeout and TIMERWRAP to be there
    t.strictDeepEqual(
      asyncOperationTypes.sort(),
      ['TIMERWRAP', 'Timeout']
    )

    t.end()
  })
})
