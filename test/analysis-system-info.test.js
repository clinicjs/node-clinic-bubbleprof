'use strict'

const test = require('tap').test
const { FakeSystemInfo } = require('./analysis-util')

test('Stack Trace - isExternal', function (t) {
  const root = new FakeSystemInfo('/')
  const modules = new FakeSystemInfo('/node_modules/internal')
  const modulesDeep = new FakeSystemInfo('/node_modules/internal/deep')
  const modulesPrivate = new FakeSystemInfo('/node_modules/@private/internal')

  t.strictEqual(root.moduleDirectory, '')
  t.strictEqual(modules.moduleDirectory, '/node_modules/internal')
  t.strictEqual(modulesDeep.moduleDirectory, '/node_modules/internal')
  t.strictEqual(modulesPrivate.moduleDirectory,
    '/node_modules/@private/internal')

  t.end()
})
