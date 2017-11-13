'use strict'

const data = require('./data.json') // base64 encoded source file

function loaddata (callback) {
  setTimeout(function () {
    callback(null, wrapData(data))
  })
}
module.exports = loaddata

function wrapData (data) {
  return new Map(
    data.map((node) => [node.nodeId, new AggregateNode(node)])
  )
}

class AggregateNode {
  constructor (node) {
    this.root = (node.nodeId === 1)

    this.nodeId = node.nodeId
    this.parentNodeId = node.parentNodeId
    this.children = node.children
    this.type = node.type

    if (this.root) {
      this.frames = []
      this.sources = []
    } else {
      this.frames = node.frames.map((frame) => new Frame(frame))
      this.sources = node.sources.map((source) => new SourceNode(source))
    }
  }

  stackTrace () {
    return this.frames.map((frame) => frame.format()).join('\n')
  }
}

class Frame {
  constructor (frame) {
    this.functionName = frame.functionName
    this.typeName = frame.typeName
    this.evalOrigin = frame.evalOrigin
    this.fileName = frame.fileName
    this.lineNumber = frame.lineNumber
    this.columnNumber = frame.columnNumber
    this.isEval = frame.isEval
    this.isConstructor = frame.isConstructor
    this.isNative = frame.isNative
    this.isToplevel = frame.isToplevel
  }

  format () {
    // Get name
    let name = this.functionName ? this.functionName : '<anonymous>'
    if (this.isEval) {
      // no change
    } else if (this.isToplevel) {
      // no change
    } else if (this.isConstructor) {
      name = 'new ' + name
    } else if (this.isNative) {
      name = 'native ' + name
    } else {
      name = this.typeName + '.' + name
    }

    // Get position
    let formatted = '    at ' + name
    if (this.isEval) {
      formatted += ' ' + this.evalOrigin
    } else {
      formatted += ' ' + this.fileName
      formatted += ':' + (this.lineNumber > 0 ? this.lineNumber : '')
      formatted += (this.columnNumber > 0 ? ':' + this.columnNumber : '')
    }

    return formatted
  }
}

class SourceNode {
  constructor (source) {
    this.asyncId = source.asyncId
    this.triggerAsyncId = source.triggerAsyncId
    this.init = source.init
    this.before = source.before
    this.after = source.after
    this.destroy = source.destroy
  }
}
