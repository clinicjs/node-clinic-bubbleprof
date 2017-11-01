'use strict'

const test = require('tap').test
const stackTrace = require('../collect/stack-trace.js')

test('stack trace - function scope', function (t) {
  let frames = null;
  (function functionScope () {
    frames = stackTrace()
  })()

  t.strictDeepEqual(frames[0].toJSON(), {
    functionName: 'functionScope',
    typeName: '',
    isEval: false,
    isConstructor: false,
    isNative: false,
    isToplevel: true,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 9,
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

  t.strictDeepEqual(frames[0].toJSON(), {
    functionName: 'method',
    typeName: 'Type',
    isEval: false,
    isConstructor: false,
    isNative: false,
    isToplevel: false,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 31,
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

  t.strictDeepEqual(frames[0].toJSON(), {
    functionName: 'Type',
    typeName: '',
    isEval: false,
    isConstructor: true,
    isNative: false,
    isToplevel: false,
    evalOrigin: '',
    fileName: __filename,
    lineNumber: 56,
    columnNumber: 21
  })

  t.end()
})
