/* global WebAssembly */
'use strict'

const test = require('tap').test
const stackTrace = require('../collect/stack-trace.js')
const { createHook } = require('async_hooks')
const fs = require('fs')
const path = require('path')

const HEADER_OFFSET = 10

test('stack trace - function scope', function (t) {
  let frames = null;
  (function functionScope () {
    frames = stackTrace()
  })()

  t.strictSame(Object.assign({}, frames[0]), {
    functionName: 'functionScope',
    typeName: '',
    isEval: false,
    isConstructor: false,
    isNative: false,
    isToplevel: true,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 5 + HEADER_OFFSET,
    columnNumber: 14
  })

  t.end()
})

test('stack trace - method', function (t) {
  class Type {
    method () {
      return stackTrace()
    }
  }
  const type = new Type()
  const frames = type.method()

  t.strictSame(Object.assign({}, frames[0]), {
    functionName: 'method',
    typeName: 'Type',
    isEval: false,
    isConstructor: false,
    isNative: false,
    isToplevel: false,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 27 + HEADER_OFFSET,
    columnNumber: 14
  })

  t.end()
})

test('stack trace - constructor', function (t) {
  class Type {
    constructor () {
      this.frames = stackTrace()
    }
  }
  const frames = (new Type()).frames

  t.strictSame(Object.assign({}, frames[0]), {
    functionName: 'Type',
    typeName: '',
    isEval: false,
    isConstructor: true,
    isNative: false,
    isToplevel: false,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 52 + HEADER_OFFSET,
    columnNumber: 21
  })

  t.end()
})

test('stack trace - eval', function (t) {
  const frames = eval('stackTrace()') // eslint-disable-line no-eval

  t.strictSame(Object.assign({}, frames[0]), {
    functionName: 'eval',
    typeName: '',
    isEval: true,
    isConstructor: false,
    isNative: false,
    isToplevel: true,
    evalOrigin: `eval at <anonymous> (${__filename}:${74 + HEADER_OFFSET}:18)`,
    fileName: '',
    lineNumber: 1,
    columnNumber: 1
  })

  t.end()
})

test('stack trace - native', function (t) {
  let frames = [];
  // sort is a V8 builtin, a stack trace from within sort thus have a
  // native call-site.
  [1, 2].sort(function (a, b) {
    frames = stackTrace()
    return 0
  })

  const v8VersionParts = process.versions.v8.split('.')
  const isTorqueSortVersion = parseInt(v8VersionParts[0], 10) >= 7

  const expectedTorque = {
    functionName: 'sort',
    typeName: 'Array',
    isEval: false,
    isConstructor: false,
    isNative: false,
    isToplevel: false,
    evalOrigin: '',
    fileName: '',
    lineNumber: 0,
    columnNumber: 0
  }

  const expectedNative = {
    functionName: 'sort',
    typeName: '',
    isEval: false,
    isConstructor: false,
    isNative: true,
    isToplevel: false,
    evalOrigin: '',
    fileName: 'native array.js',
    lineNumber: 1,
    columnNumber: 1
  }

  t.strictSame(
    Object.assign({}, frames[1]),
    isTorqueSortVersion ? expectedTorque : expectedNative
  )

  t.end()
})

test('stack trace - filter async_hooks', function (t) {
  let frames = []
  const hooks = createHook({
    init () {
      frames = stackTrace()
    }
  })

  hooks.enable()
  process.nextTick(function () {
    hooks.disable()

    t.ok(frames.every(function (frame) {
      return (frame.fileName !== 'async_hooks.js' &&
              frame.fileName !== 'internal/async_hooks.js')
    }))
    t.end()
  })
})

test('stack trace - work with wasm', async function (t) {
  let frames = []
  const hooks = createHook({
    init () {
      frames = stackTrace()
    }
  })

  const wasmBuffer = fs.readFileSync(path.join(__dirname, 'fixtures-wasm/say-hello.wasm'))

  hooks.enable()

  await WebAssembly.instantiate(wasmBuffer, {
    env: {
      trace () {
        process.nextTick(() => {
          hooks.disable()

          t.ok(frames.every(function (frame) {
            return frame.typeName !== null
          }))
          t.end()
        })
      }
    }
  })
})
