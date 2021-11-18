'use strict'

const { test } = require('tap')
const rimraf = require('rimraf')
const ClinicBubbleprof = require('../index.js')

test('test collect - emits "analysing" event', function (t) {
  const tool = new ClinicBubbleprof()

  function cleanup (err, dirname) {
    t.error(err)
    t.match(dirname, /^[0-9]+\.clinic-bubbleprof$/)
    rimraf(dirname, (err) => {
      t.error(err)
      t.end()
    })
  }

  let seenAnalysing = false
  tool.on('analysing', () => {
    seenAnalysing = true
  })

  tool.collect(
    [process.execPath, '-e', 'setTimeout(() => {}, 123)'],
    function (err, dirname) {
      if (err) return cleanup(err, dirname)

      t.ok(seenAnalysing) // should've happened before this callback
      cleanup(null, dirname)
    }
  )
})
