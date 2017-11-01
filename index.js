'use strict'

const fs = require('fs')
const path = require('path')
const async = require('async')
const { spawn } = require('child_process')
const getStackTraceFilename = require('./collect/get-stack-trace-filename.js')
const getTraceEventsFilename = require('./collect/get-trace-events-filename.js')
const getLoggingDirname = require('./collect/get-logging-dirname.js')


class ClinicBubbleprof {
  constructor (settings = {}) {

  }

  collect (args, callback) {
    const samplerPath = path.resolve(__dirname, 'logger.js')

    // run program, but inject the sampler
    const proc = spawn(args[0], [
      '-r', samplerPath,
      '--trace-events-enabled', '--trace-event-categories', 'node.async_hooks'
    ].concat(args.slice(1)), {
      stdio: 'inherit'
    })

    // relay SIGINT to process
    process.once('SIGINT', () => proc.kill('SIGINT'))

    proc.once('exit', function (code, signal) {
      // the process did not exit normally
      if (code !== 0 && signal !== 'SIGINT') {
        if (code !== null) {
          return callback(new Error(`process exited with exit code ${code}`))
        } else {
          return callback(new Error(`process exited by signal ${signal}`))
        }
      }

      // get filenames of logfiles
      const stackTraceFilepath = path.resolve(getStackTraceFilename(proc.pid))
      const traceEventsFilepath = path.resolve('node_trace.1.log')
      const loggingDirname = getLoggingDirname(proc.pid)

      // create directory and move files to that directory
      fs.mkdir(loggingDirname, function (err) {
        if (err) return callback(err);

        async.parallel([
          function (done) {
            fs.rename(
              stackTraceFilepath,
              path.join(loggingDirname, getStackTraceFilename(proc.pid)),
              done
            )
          },
          function (done) {
            fs.rename(
              traceEventsFilepath,
              path.join(loggingDirname, getTraceEventsFilename(proc.pid)),
              done
            )
          }
        ], function (err) {
          if (err) return callback(err)
          callback(null, loggingDirname)
        })
      })
    })
  }

  visualize (dataFilename, outputFilename, callback) {
    process.nextTick(callback, new Error('bubbleprof is not implemented'))
  }
}

module.exports = ClinicBubbleprof
