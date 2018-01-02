'use strict'

const test = require('tap').test
const getLoggingPaths = require('../collect/get-logging-paths.js')

test('Collect - logging path - identifier', function (t) {
  const paths = getLoggingPaths({ identifier: 1062 })

  t.strictDeepEqual(paths, {
    '/': '1062.clinic-bubbleprof',
    '/systeminfo': '1062.clinic-bubbleprof/1062.clinic-bubbleprof-systeminfo',
    '/stacktrace': '1062.clinic-bubbleprof/1062.clinic-bubbleprof-stacktrace',
    '/traceevent': '1062.clinic-bubbleprof/1062.clinic-bubbleprof-traceevent'
  })
  t.end()
})

test('Collect - logging path - path', function (t) {
  const paths = getLoggingPaths({ path: '/root/1062.clinic-bubbleprof' })

  t.strictDeepEqual(paths, {
    '/': '/root/1062.clinic-bubbleprof',
    '/systeminfo': '/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-systeminfo',
    '/stacktrace': '/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-stacktrace',
    '/traceevent': '/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-traceevent'
  })
  t.end()
})

test('Collect - logging path - bad type', function (t) {
  t.throws(
    () => getLoggingPaths({}),
    new Error('missing either identifier or path value')
  )
  t.end()
})
