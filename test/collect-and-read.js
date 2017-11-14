'use strict'

const fs = require('fs')
const async = require('async')
const events = require('events')
const getLoggingPaths = require('../collect/get-logging-paths.js')
const ClinicBubbleprof = require('../index.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventsDecoder = require('../format/trace-events-decoder.js')

class CollectAndRead extends events.EventEmitter {
  constructor (...args) {
    super()
    const self = this
    const tool = new ClinicBubbleprof()

    tool.collect([process.execPath, ...args], function (err, dirname) {
      if (err) return self.emit('error', err)

      const files = getLoggingPaths(dirname.split('.')[0])

      const stacktrace = fs.createReadStream(files['/stacktrace'])
        .pipe(new StackTraceDecoder())
      const traceevents = fs.createReadStream(files['/traceevents'])
        .pipe(new TraceEventsDecoder())

      self._setupAutoCleanup(files, stacktrace, traceevents)
      self.emit('ready', stacktrace, traceevents)
    })
  }

  _setupAutoCleanup (files, stacktrace, traceevents) {
    const self = this

    async.parallel({
      stackTraces (done) {
        stacktrace.once('end', function () {
          fs.unlink(files['/stacktrace'], function (err) {
            if (err) return done(err)
            done(null)
          })
        })
      },
      traveEvents (done) {
        traceevents.once('end', function () {
          fs.unlink(files['/traceevents'], function (err) {
            if (err) return done(err)
            done(null)
          })
        })
      }
    }, function (err, output) {
      if (err) return self.emit('error', err)

      fs.rmdir(files['/'], function (err) {
        if (err) return self.emit('error', err)
      })
    })
  }
}

module.exports = CollectAndRead
