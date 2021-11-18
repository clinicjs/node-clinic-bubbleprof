'use strict'

const test = require('tap').test
const path = require('path')
const getLoggingPaths = require('@clinic/clinic-common').getLoggingPaths('bubbleprof')

test('Collect - logging path - identifier', function (t) {
  const paths = getLoggingPaths({ identifier: 1062 })

  t.strictSame(paths, {
    '/': '1062.clinic-bubbleprof',
    '/systeminfo': path.normalize('1062.clinic-bubbleprof/1062.clinic-bubbleprof-systeminfo'),
    '/stacktrace': path.normalize('1062.clinic-bubbleprof/1062.clinic-bubbleprof-stacktrace'),
    '/traceevent': path.normalize('1062.clinic-bubbleprof/1062.clinic-bubbleprof-traceevent')
  })
  t.end()
})

test('Collect - logging path - path', function (t) {
  const paths = getLoggingPaths({ path: path.normalize('/root/1062.clinic-bubbleprof') })

  t.strictSame(paths, {
    '/': path.normalize('/root/1062.clinic-bubbleprof'),
    '/systeminfo': path.normalize('/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-systeminfo'),
    '/stacktrace': path.normalize('/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-stacktrace'),
    '/traceevent': path.normalize('/root/1062.clinic-bubbleprof/1062.clinic-bubbleprof-traceevent')
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
