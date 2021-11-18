const test = require('tap').test
const fs = require('fs')
const rimraf = require('rimraf')
const ClinicBubbleprof = require('../index.js')

test('cmd - test collect - custom output destination', (t) => {
  const tool = new ClinicBubbleprof({ debug: true, dest: 'test-output-destination' })

  function cleanup (err, dirname) {
    t.error(err)
    t.match(dirname, /^test-output-destination[/\\][0-9]+\.clinic-bubbleprof$/)

    rimraf('test-output-destination', (err) => {
      t.error(err)
      t.end()
    })
  }

  tool.collect(
    [process.execPath, '-e', 'setTimeout(() => {}, 200)'],
    function (err, dirname) {
      if (err) return cleanup(err, dirname)

      t.ok(fs.statSync(dirname).isDirectory())

      tool.visualize(dirname, `${dirname}.html`, (err) => {
        if (err) return cleanup(err, dirname)

        t.ok(fs.statSync(`${dirname}.html`).isFile())

        cleanup(null, dirname)
      })
    }
  )
})
