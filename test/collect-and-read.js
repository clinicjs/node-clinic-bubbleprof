'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const async = require('async')
const rimraf = require('rimraf')
const events = require('events')
const endpoint = require('endpoint')
const getLoggingPaths = require('../collect/get-logging-paths.js')
const ClinicBubbleprof = require('../index.js')
const SystemInfoDecoder = require('../format/system-info-decoder.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const TraceEventDecoder = require('../format/trace-event-decoder.js')

const testServerSockPath = path.resolve(__dirname, '.test-server.sock')

function waitForFile (filepath, timeout, callback) {
  fs.access(filepath, function (err) {
    if (!err) return callback(null)
    if (timeout <= 0) {
      return callback(new Error('server did not listen within timeout'))
    }

    setTimeout(function () {
      waitForFile(filepath, timeout - 50, callback)
    }, Math.min(timeout, 50))
  })
}

class CollectAndRead extends events.EventEmitter {
  constructor (options, ...args) {
    super()
    const self = this
    const tool = new ClinicBubbleprof()

    fs.unlink(testServerSockPath, function (err) {
      if (err && err.code !== 'ENOENT') return self.emit('error', err)

      tool.collect([process.execPath, ...args], function (err, dirname) {
        self.files = getLoggingPaths({ path: dirname })

        if (err) return self.emit('error', err)

        const systeminfo = fs.createReadStream(self.files['/systeminfo'])
          .pipe(new SystemInfoDecoder())
        const stacktrace = fs.createReadStream(self.files['/stacktrace'])
          .pipe(new StackTraceDecoder())
        const traceevent = fs.createReadStream(self.files['/traceevent'])
          .pipe(new TraceEventDecoder())

        self._setupAutoCleanup(systeminfo, stacktrace, traceevent)
        self.emit('ready', systeminfo, stacktrace, traceevent)
      })
    })
  }

  request (href, callback) {
    waitForFile(testServerSockPath, 1000, function (err) {
      if (err) return callback(err)
      http.get({
        socketPath: testServerSockPath,
        path: href
      }, function (res) {
        res.pipe(endpoint(callback))
      })
    })
  }

  cleanup () {
    rimraf.sync(this.files['/'])
  }

  _setupAutoCleanup (systeminfo, stacktrace, traceevent) {
    const self = this

    async.parallel({
      systemInfo (done) {
        systeminfo.once('end', function () {
          fs.unlink(self.files['/systeminfo'], function (err) {
            if (err) return done(err)
            done(null)
          })
        })
      },
      stackTraces (done) {
        stacktrace.once('end', function () {
          fs.unlink(self.files['/stacktrace'], function (err) {
            if (err) return done(err)
            done(null)
          })
        })
      },
      traveEvents (done) {
        traceevent.once('end', function () {
          fs.unlink(self.files['/traceevent'], function (err) {
            if (err) return done(err)
            done(null)
          })
        })
      }
    }, function (err, output) {
      if (err) return self.emit('error', err)

      fs.rmdir(self.files['/'], function (err) {
        if (err) return self.emit('error', err)
      })
    })
  }
}

module.exports = CollectAndRead
