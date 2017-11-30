'use strict'

const util = require('util')
const { murmurHash128 } = require('murmurhash-native')

class SourceNode {
  constructor (asyncId) {
    this.asyncId = asyncId
    this.identifier = null
    this.mark = null

    // parent
    this.parentAsyncId = null
    this.triggerAsyncId = null
    this.executionAsyncId = null

    // async type
    this.type = null

    // stack trace
    this.frames = null

    // event timestamps
    this.init = null
    this.before = []
    this.after = []
    this.destroy = null
  }

  [util.inspect.custom] (depth, options) {
    return `<SourceNode` +
           ` type:${options.stylize(this.type, 'string')},` +
           ` asyncId:${options.stylize(this.asyncId, 'number')},` +
           ` parentAsyncId:${options.stylize(this.parentAsyncId, 'number')},` +
           ` triggerAsyncId:${options.stylize(this.triggerAsyncId, 'number')},` +
           ` executionAsyncId:${options.stylize(this.executionAsyncId, 'number')},` +
           ` identifier:${options.stylize(this.identifier, 'special')}>`
  }

  setMark (mark) {
    this.mark = mark
  }

  setIdentifier (identifier) {
    this.identifier = murmurHash128(identifier)
  }

  setParentAsyncId(asyncId) {
    this.parentAsyncId = asyncId;
  }

  addStackTrace (info) {
    this.frames = info.frames
  }

  addTraceEvent (info) {
    switch (info.event) {
      case 'init':
        this.type = info.type
        this.init = info.timestamp
        this.triggerAsyncId = info.triggerAsyncId
        this.executionAsyncId = info.executionAsyncId
        this.setParentAsyncId(info.triggerAsyncId)
        break
      case 'destroy':
        this.destroy = info.timestamp
        break
      case 'before':
        this.before.push(info.timestamp)
        break
      case 'after':
        this.after.push(info.timestamp)
        break
    }
  }

  isComplete () {
    return (this.hasStackTrace() &&
            this.destroy !== null &&
            this.before.length === this.after.length)
  }

  hasStackTrace () {
    return this.frames !== null
  }

  positionalStackTrace () {
    const framesPosition = this.frames.map(function (frame) {
      let position = frame.fileName
      if (frame.lineNumber > 0) {
        position += ':' + frame.lineNumber
      }
      if (frame.columnNumber > 0) {
        position += ':' + frame.columnNumber
      }

      if (frame.isEval) {
        position += ' ' + frame.evalOrigin
      }

      return position
    })

    return framesPosition.join('\n')
  }
}

module.exports = SourceNode
