'use strict'

const events = require('events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const pump = require('pump')
const { spawn } = require('child_process')
const analysis = require('./analysis/index.js')
const joinTrace = require('node-trace-log-join')
const getLoggingPaths = require('@nearform/clinic-common').getLoggingPaths('bubbleprof')
const SystemInfoDecoder = require('./format/system-info-decoder.js')
const StackTraceDecoder = require('./format/stack-trace-decoder.js')
const TraceEventDecoder = require('./format/trace-event-decoder.js')
const minifyInline = require('./lib/minify-inline')
const buildJs = require('@nearform/clinic-common/scripts/build-js')
const buildCss = require('@nearform/clinic-common/scripts/build-css')
const mainTemplate = require('@nearform/clinic-common/templates/main')

class ClinicBubbleprof extends events.EventEmitter {
  constructor (settings = {}) {
    super()

    const {
      detectPort = false,
      debug = false,
      dest = null
    } = settings

    this.detectPort = detectPort
    this.debug = debug
    this.path = dest
  }

  collect (args, callback) {
    // run program, but inject the sampler
    const logArgs = [
      '-r', 'no-cluster.js',
      '-r', 'logger.js',
      '--trace-events-enabled', '--trace-event-categories', 'node.async_hooks'
    ]

    const stdio = ['inherit', 'inherit', 'inherit']

    if (this.detectPort) {
      logArgs.push('-r', 'detect-port.js')
      stdio.push('pipe')
    }

    const customEnv = {
      NODE_PATH: path.join(__dirname, 'injects'),
      NODE_OPTIONS: logArgs.join(' ') + (
        process.env.NODE_OPTIONS ? ' ' + process.env.NODE_OPTIONS : ''
      )
    }

    if (this.path) {
      customEnv.NODE_CLINIC_BUBBLEPROF_DATA_PATH = this.path
    }

    const proc = spawn(args[0], args.slice(1), {
      stdio,
      env: Object.assign({}, process.env, customEnv)
    })

    if (this.detectPort) {
      proc.stdio[3].once('data', data => this.emit('port', Number(data), proc, () => proc.stdio[3].destroy()))
    }

    // get filenames of logfiles
    const paths = getLoggingPaths({
      path: this.path,
      identifier: proc.pid
    })

    // relay SIGINT to process
    process.once('SIGINT', function () {
      // we cannot kill(SIGINT) on windows but it seems
      // to relay the ctrl-c signal per default, so only do this
      // if not windows
      /* istanbul ignore else: windows hack */
      if (os.platform() !== 'win32') proc.kill('SIGINT')
    })

    proc.once('exit', (code, signal) => {
      // Windows exit code STATUS_CONTROL_C_EXIT 0xC000013A returns 3221225786
      // if not caught. See https://msdn.microsoft.com/en-us/library/cc704588.aspx
      /* istanbul ignore next: windows hack */
      if (code === 3221225786 && os.platform() === 'win32') signal = 'SIGINT'

      // report if the process did not exit normally.
      if (code !== 0 && signal !== 'SIGINT') {
        if (code !== null) {
          console.error(`process exited with exit code ${code}`)
        } else {
          console.error(`process exited by signal ${signal}`)
        }
      }

      this.emit('analysing')

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
    this._visualize(dataDirname, outputFilename, (err) => {
      if (err || this.debug) return callback(err)

      // Having a hard time getting V8 to GC the streams from the _visualize call.
      // Might be a memory leak or might be something fishy with the V8 Frame objects ...
      // Anyway the smarter minifier fixes this for now. YOLO.

      minifyInline(outputFilename, { sourceMap: false, mangle: false }, callback)
    })
  }

  _visualize (dataDirname, outputFilename, callback) {
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
      systemInfoReader, stackTraceReader, traceEventReader, { stringify: true }
    )
    // add logos
    const logoFile = fs.createReadStream(logoPath)
    const nearFormLogoFile = fs.createReadStream(nearFormLogoPath)
    const clinicFaviconBase64 = fs.createReadStream(clinicFaviconPath)

    dataFile.on('warning', msg => this.emit('warning', msg))

    // build JS
    let scriptFile = buildJs({
      basedir: __dirname,
      debug: this.debug,
      fakeDataPath,
      scriptPath,
      beforeBundle: b => b.require(dataFile, {
        file: fakeDataPath
      })
    })

    // build CSS
    const styleFile = buildCss({
      stylePath,
      debug: this.debug
    })

    // build output file
    const outputFile = mainTemplate({
      favicon: clinicFaviconBase64,
      title: 'Clinic Bubbleprof',
      styles: styleFile,
      script: scriptFile,
      headerLogoUrl: 'https://github.com/nearform/node-clinic-bubbleprof',
      headerLogoTitle: 'Clinic Bubbleprof on GitHub',
      headerLogo: logoFile,
      headerText: 'Bubbleprof',
      nearFormLogo: nearFormLogoFile,
      uploadId: outputFilename.split('/').pop().split('.html').shift(),
      bodyClass: 'has-no-spinner is-loading-font',
      body: '<div class="ncb-font-spinner-container"></div>'
    })

    pump(
      outputFile,
      fs.createWriteStream(outputFilename),
      callback
    )
  }
}

module.exports = ClinicBubbleprof
