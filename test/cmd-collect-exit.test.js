'use strict'

const test = require('tap').test
const path = require('path')
const async = require('async')
const { spawn } = require('child_process')
const endpoint = require('endpoint')
const CollectAndRead = require('./collect-and-read.js')

testNotWindows('cmd - collect - external SIGINT is relayed', function (t) {
  const child = spawn(
    process.execPath, [
      path.resolve(__dirname, 'cmd-collect-exit-sigint.script.js')
    ], {
      cwd: __dirname
    }
  )

  child.stdout.once('data', () => child.kill('SIGINT'))

  async.parallel({
    stdout (done) { child.stdout.pipe(endpoint(done)) },
    stderr (done) { child.stderr.pipe(endpoint(done)) }
  }, function (err, output) {
    if (err) return t.error(err)

    // Expect the WARNING output to be shown
    t.ok(output.stderr.toString().split('\n').length, 1)
    t.equal(output.stdout.toString(),
      'listening for SIGINT\nSIGINT received\n')
    t.end()
  })
})

test('cmd - collect - non-success exit code should not throw', function (t) {
  const cmd = new CollectAndRead({}, '--expose-gc', '-e', 'process.exit(1)')
  cmd.on('error', t.error.bind(t))
  cmd.on('ready', function () {
    t.end()
  })
})

function testNotWindows (msg, fn) {
  if (process.platform !== 'win32') test(msg, fn)
}
