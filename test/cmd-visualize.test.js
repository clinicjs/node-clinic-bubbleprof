'use strict'

const fs = require('fs')
const test = require('tap').test
const async = require('async')
const rimraf = require('rimraf')
const ClinicBubbleprof = require('../index.js')

test('cmd - test visualization', function (t) {
  const tool = new ClinicBubbleprof()

  function cleanup (err, dirname) {
    t.error(err)

    async.parallel([
      (done) => rimraf(dirname, done),
      (done) => fs.unlink(dirname + '.html', done)
    ], function (err) {
      t.error(err)
      t.end()
    })
  }

  tool.collect(
    [process.execPath, '-e', 'setTimeout(() => {}, 200)'],
    function (err, dirname) {
      if (err) return cleanup(err, dirname)

      tool.visualize(dirname, dirname + '.html', function (err) {
        if (err) return cleanup(err, dirname)

        fs.readFile(dirname + '.html', function (err, content) {
          if (err) return cleanup(err, dirname)

          t.ok(content.length > 1024)
          cleanup(null, dirname)
        })
      })
    }
  )
})
