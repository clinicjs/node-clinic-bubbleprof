'use strict'

function noFormat (errorObject, structuredStackTrace) {
  return structuredStackTrace
}

class Frame {
  constructor (frame) {
    this.functionName = frame.getFunctionName() || ''
    this.typeName = ''
    this.evalOrigin = ''
    this.fileName = ''
    this.lineNumber = 0
    this.columnNumber = 0

    this.isEval = false
    this.isConstructor = false
    this.isNative = false
    this.isToplevel = false

    // Only one of these can be true. Test in the order of most likely.
    if (frame.isToplevel()) {
      this.isToplevel = true
    } else if (frame.isConstructor()) {
      this.isConstructor = true
    } else if (frame.isNative()) {
      this.isNative = true
    } else {
      this.typeName = frame.getTypeName()
    }

    // Get source
    this.fileName = frame.getFileName() || ''
    this.lineNumber = (
      frame.getLineNumber() || /* istanbul ignore next: no known case */ 0
    )
    this.columnNumber = (
      frame.getColumnNumber() || /* istanbul ignore next: no known case */ 0
    )

    // If the fileName is empty, the error could be from an eval. Check
    // frame.isEval() to be sure. We check the `this.fileName` first to avoid
    // the overhead from `frame.isEval()`
    if (this.fileName === '' && frame.isEval()) {
      this.isEval = true
      this.evalOrigin = frame.getEvalOrigin()
    }

    if (this.typeName === null) {
      /* istanbul ignore if | only on node 16+ we have wasm fileNames */
      if (this.fileName.startsWith('wasm://')) {
        this.typeName = 'wasm'
      } else {
        this.typeName = ''
      }
    }
  }
}

function stackTrace (skip) {
  // overwrite stack trace limit and formatting
  const restoreFormat = Error.prepareStackTrace
  const restoreLimit = Error.stackTraceLimit
  Error.prepareStackTrace = noFormat
  Error.stackTraceLimit = Infinity

  // collect stack trace
  const obj = {}
  Error.captureStackTrace(obj, stackTrace)
  const structuredStackTrace = obj.stack

  // restore limit and formatting
  Error.prepareStackTrace = restoreFormat
  Error.stackTraceLimit = restoreLimit

  // extract data
  const frames = structuredStackTrace.map((frame) => new Frame(frame))

  // Don't include async_hooks frames
  return frames.slice(skip).filter(function (frame) {
    return (frame.fileName !== 'async_hooks.js' &&
            frame.fileName !== 'internal/async_hooks.js' &&
            frame.fileName !== 'node:internal/async_hooks')
  })
}
module.exports = stackTrace
