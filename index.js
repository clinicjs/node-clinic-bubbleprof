'use strict'

const fs = require('fs')
const path = require('path')
const pump = require('pump')
const { spawn } = require('child_process')
const analysis = require('./analysis/index.js')
const Stringify = require('streaming-json-stringify')
const browserify = require('browserify')
const streamTemplate = require('stream-template')
const getLoggingPaths = require('./collect/get-logging-paths.js')
const StackTraceDecoder = require('./format/stack-trace-decoder.js')
const TraceEventsDecoder = require('./format/trace-events-decoder.js')

class ClinicBubbleprof {
  collect (args, callback) {
    const samplerPath = path.resolve(__dirname, 'logger.js')

    // run program, but inject the sampler
    const logArgs = [
      '-r', samplerPath,
      '--trace-events-enabled', '--trace-event-categories', 'node.async_hooks'
    ]
    const proc = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      env: Object.assign({}, process.env, {
        NODE_OPTIONS: logArgs.join(' ') + (
          process.env.NODE_OPTIONS ? ' ' + process.env.NODE_OPTIONS : ''
        )
      })
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
      const paths = getLoggingPaths(proc.pid)

      // create directory and move files to that directory
      fs.rename(
        'node_trace.1.log', paths['/traceevents'],
        function (err) {
          if (err) return callback(err)
          callback(null, paths['/'])
        }
      )
    })
  }

  visualize (dataDirname, outputFilename, callback) {
    const fakeDataPath = path.join(__dirname, 'visualizer', 'data.json')
    const stylePath = path.join(__dirname, 'visualizer', 'style.css')
    const scriptPath = path.join(__dirname, 'visualizer', 'main.js')

    // Load data
    const paths = getLoggingPaths(dataDirname.split('.')[0])
    const stackTraceReader = fs.createReadStream(paths['/stacktrace'])
      .pipe(new StackTraceDecoder())
    const traceEventsReader = fs.createReadStream(paths['/traceevents'])
      .pipe(new TraceEventsDecoder())

    // create dataFile
    const dataFile = analysis(stackTraceReader, traceEventsReader)
      .pipe(new Stringify({
        seperator: ',\n',
        stringifier: JSON.stringify
      }))

    // create script-file stream
    const b = browserify({
      'basedir': __dirname,
      // 'debug': true,
      'noParse': [fakeDataPath]
    })
    b.transform('brfs')
    b.require(dataFile, {
      'file': fakeDataPath
    })
    b.add(scriptPath)
    const scriptFile = b.bundle()

    // create style-file stream
    const styleFile = fs.createReadStream(stylePath)

    // build output file
    const outputFile = streamTemplate`
      <!DOCTYPE html>
      <meta charset="utf8">
      <title>Clinic Bubbleprof</title>
      <style>${styleFile}</style>
      <div id="banner"></div>
      <script>${scriptFile}</script>
    `

    pump(
      outputFile,
      fs.createWriteStream(outputFilename),
      callback
    )
  }
}

module.exports = ClinicBubbleprof
