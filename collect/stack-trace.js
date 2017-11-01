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
    } else if (frame.isEval()) {
      this.isEval = true
    } else {
      this.typeName = frame.getTypeName()
    }

    // Get source
    if (this.isEval) {
      this.evalOrigin = frame.getEvalOrigin()
    } else {
      this.fileName = frame.getFileName() || ''
      this.lineNumber = frame.getLineNumber() || 0
      this.columnNumber = frame.getColumnNumber() || 0
    }
  }

  // This is only used for testing. Because strictDeepEqual checks the
  // constructor type too.
  toJSON () {
    return {
      functionName: this.functionName,
      typeName: this.typeName,
      isEval: this.isEval,
      isConstructor: this.isConstructor,
      isNative: this.isNative,
      isToplevel: this.isToplevel,
      evalOrigin: this.evalOrigin,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber
    }
  }
}

function stackTrace () {
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
  return structuredStackTrace.map((frame) => new Frame(frame))
}
module.exports = stackTrace
