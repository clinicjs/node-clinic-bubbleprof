'use strict'

const events = require('events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const pump = require('pump')
const { spawn } = require('child_process')
const analysis = require('./analysis/index.js')
const joinTrace = require('@clinic/node-trace-log-join')
const getLoggingPaths = require('@clinic/clinic-common').getLoggingPaths('bubbleprof')
const SystemInfoDecoder = require('./format/system-info-decoder.js')
const StackTraceDecoder = require('./format/stack-trace-decoder.js')
const TraceEventDecoder = require('./format/trace-event-decoder.js')
const minifyStream = require('minify-stream')
const buildJs = require('@clinic/clinic-common/scripts/build-js')
const buildCss = require('@clinic/clinic-common/scripts/build-css')
const mainTemplate = require('@clinic/clinic-common/templates/main')

class ClinicBubbleprof extends events.EventEmitter {
  constructor (settings = {}) {
    super()

    const {
      detectPort = false,
      debug = false,
      dest = null,
      name
    } = settings

    this.detectPort = detectPort
    this.debug = debug
    this.path = dest
    this.name = name
  }

  collect (args, callback) {
    // run program, but inject the sampler
    const logArgs = [
      '-r', 'no-cluster.js',
      '-r', 'logger.js',
      '--trace-events-enabled', '--trace-event-categories', 'node.async_hooks'
    ]

    const stdio = ['inherit', 'inherit', 'inherit', 'pipe']

    if (this.detectPort) {
      logArgs.push('-r', 'detect-port.js')
    }

    let NODE_PATH = path.join(__dirname, 'injects')
    // use NODE_PATH to work around issues with spaces in inject path
    if (process.env.NODE_PATH) {
      NODE_PATH += `${process.platform === 'win32' ? ';' : ':'}${process.env.NODE_PATH}`
    }

    const customEnv = {
      NODE_PATH,
      NODE_OPTIONS: logArgs.join(' ') + (
        process.env.NODE_OPTIONS ? ' ' + process.env.NODE_OPTIONS : ''
      )
    }

    if (this.path) {
      customEnv.NODE_CLINIC_BUBBLEPROF_DATA_PATH = this.path
    }

    if (this.name) {
      customEnv.NODE_CLINIC_BUBBLEPROF_NAME = this.name
    }

    const proc = spawn(args[0], args.slice(1), {
      stdio,
      env: Object.assign({}, process.env, customEnv)
    })

    proc.stdio[3].on('data', data => {
      if (data.toString() === 'source_warning') {
        this.emit('warning', 'The code is transpiled, bubbleprof does not support source maps yet.')
      } else if (this.detectPort) {
        this.emit('port', Number(data), proc, () => proc.stdio[3].destroy())
      }
    })

    // get filenames of logfiles
    const paths = getLoggingPaths({
      path: this.path,
      identifier: this.name || proc.pid
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
    const stylePath = path.join(__dirname, 'visualizer', 'style.css')
    const scriptPath = path.join(__dirname, 'visualizer', 'main.js')
    const logoPath = path.join(__dirname, 'visualizer', 'app-logo.svg')
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
    const clinicFaviconBase64 = fs.createReadStream(clinicFaviconPath)

    const bubbleprofVersion = require('./package.json').version

    dataFile.on('warning', msg => this.emit('warning', msg))

    // build JS
    let scriptFile = buildJs({
      basedir: __dirname,
      debug: this.debug,
      scriptPath
    })

    if (!this.debug) {
      scriptFile = pump(scriptFile, minifyStream({ sourceMap: false, mangle: false }))
    }

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
      data: dataFile,
      script: scriptFile,
      headerLogoUrl: 'https://clinicjs.org/bubbleprof/',
      headerLogoTitle: 'Clinic Bubbleprof on Clinicjs.org',
      headerLogo: logoFile,
      headerText: 'Bubbleprof',
      toolVersion: bubbleprofVersion,
      uploadId: outputFilename.split('/').pop().split('.html').shift(),
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
