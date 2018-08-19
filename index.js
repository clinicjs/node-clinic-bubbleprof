'use strict'

const events = require('events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const pump = require('pump')
const { spawn } = require('child_process')
const analysis = require('./analysis/index.js')
const browserify = require('browserify')
const streamTemplate = require('stream-template')
const joinTrace = require('node-trace-log-join')
const getLoggingPaths = require('./collect/get-logging-paths.js')
const SystemInfoDecoder = require('./format/system-info-decoder.js')
const StackTraceDecoder = require('./format/stack-trace-decoder.js')
const TraceEventDecoder = require('./format/trace-event-decoder.js')
const minifyStream = require('minify-stream')

class ClinicBubbleprof extends events.EventEmitter {
  constructor (settings = {}) {
    super()

    this.detectPort = !!settings.detectPort
  }

  collect (args, callback) {
    // run program, but inject the sampler
    const logArgs = [
      '-r', 'logger.js',
      '--trace-events-enabled', '--trace-event-categories', 'node.async_hooks'
    ]

    const stdio = ['inherit', 'inherit', 'inherit']

    if (this.detectPort) {
      logArgs.push('-r', 'detect-port.js')
      stdio.push('pipe')
    }

    const proc = spawn(args[0], args.slice(1), {
      stdio,
      env: Object.assign({}, process.env, {
        NODE_PATH: path.join(__dirname, 'injects'),
        NODE_OPTIONS: logArgs.join(' ') + (
          process.env.NODE_OPTIONS ? ' ' + process.env.NODE_OPTIONS : ''
        )
      })
    })

    if (this.detectPort) {
      proc.stdio[3].once('data', data => this.emit('port', Number(data), proc, () => proc.stdio[3].destroy()))
    }

    // get filenames of logfiles
    const paths = getLoggingPaths({ identifier: proc.pid })

    // relay SIGINT to process
    process.once('SIGINT', function () {
      // we cannot kill(SIGINT) on windows but it seems
      // to relay the ctrl-c signal per default, so only do this
      // if not windows
      /* istanbul ignore else: windows hack */
      if (os.platform() !== 'win32') proc.kill('SIGINT')
    })

    proc.once('exit', function (code, signal) {
      // Windows exit code STATUS_CONTROL_C_EXIT 0xC000013A returns 3221225786
      // if not caught. See https://msdn.microsoft.com/en-us/library/cc704588.aspx
      /* istanbul ignore next: windows hack */
      if (code === 3221225786 && os.platform() === 'win32') signal = 'SIGINT'

      // the process did not exit normally
      if (code !== 0 && signal !== 'SIGINT') {
        if (code !== null) {
          return callback(
            new Error(`process exited with exit code ${code}`),
            paths['/']
          )
        } else {
          return callback(
            new Error(`process exited by signal ${signal}`),
            paths['/']
          )
        }
      }

      // create directory and move files to that directory
      joinTrace(
        'node_trace.*.log', paths['/traceevent'],
        function (err) {
          /* istanbul ignore if: the node_trace file should always exists */
          if (err) return callback(err, paths['/'])
          callback(null, paths['/'])
        }
      )
    })
  }

  visualize (dataDirname, outputFilename, callback) {
    const fakeDataPath = path.join(__dirname, 'visualizer', 'data.json')
    const stylePath = path.join(__dirname, 'visualizer', 'style.css')
    const scriptPath = path.join(__dirname, 'visualizer', 'main.js')
    const logoPath = path.join(__dirname, 'visualizer', 'app-logo.svg')
    const nearFormLogoPath = path.join(__dirname, 'visualizer', 'nearform-logo.svg')
    const clinicFaviconPath = path.join(__dirname, 'visualizer', 'clinic-favicon.png.b64')

    // Load data
    const paths = getLoggingPaths({ path: dataDirname })
    const systemInfoReader = fs.createReadStream(paths['/systeminfo'])
      .pipe(new SystemInfoDecoder())
    const stackTraceReader = fs.createReadStream(paths['/stacktrace'])
      .pipe(new StackTraceDecoder())
    const traceEventReader = fs.createReadStream(paths['/traceevent'])
      .pipe(new TraceEventDecoder())

    // create dataFile
    const dataFile = analysis(
      systemInfoReader, stackTraceReader, traceEventReader, {stringify: true}
    )
    // add logos
    const logoFile = fs.createReadStream(logoPath)
    const nearFormLogoFile = fs.createReadStream(nearFormLogoPath)
    const clinicFaviconBase64 = fs.createReadStream(clinicFaviconPath)

    dataFile.on('warning', msg => this.emit('warning', msg))

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
    const scriptFile = b
      .bundle()
      .pipe(minifyStream({ sourceMap: false, mangle: false }))
    // create style-file stream
    const styleFile = fs.createReadStream(stylePath)

    // build output file
    const outputFile = streamTemplate`
      <!DOCTYPE html>
      <meta charset="utf8">
      <meta name="viewport" content="width=device-width">
      <title>Clinic Bubbleprof</title>
      <link rel="shortcut icon" type="image/png" href="${clinicFaviconBase64}">
      <style>${styleFile}</style>
      <div id="banner">
        <a id="main-logo" href="https://github.com/nearform/node-clinic-bubbleprof" title="Clinic Bubbleprof on GitHub" target="_blank">
          ${logoFile}
        </a>
        <a id="company-logo" href="https://nearform.com" title="nearForm" target="_blank">
          ${nearFormLogoFile}
        </a>
      </div>
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
