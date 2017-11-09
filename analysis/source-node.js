'use strict'

const util = require('util')
const { murmurHash128 } = require('murmurhash-native')

class SourceNode {
  constructor (asyncId) {
    this.asyncId = asyncId

    // parent
    this.triggerAsyncId = null

    // async type
    this.type = null

    // stack trace
    this.frames = null
    this.framesHash = null

    // event timestamps
    this.init = null
    this.before = []
    this.after = []
    this.destroy = null
  }

  [util.inspect.custom](depth, options) {
    return `<SourceNode` +
           ` type:${options.stylize(this.type, 'string')},` +
           ` asyncId:${options.stylize(this.asyncId, 'number')},` +
           ` triggerAsyncId:${options.stylize(this.triggerAsyncId, 'number')},` +
           ` frames:${options.stylize(this.framesHash, 'special')}>`
  }

  addStackTrace (info) {
    this.frames = info.frames
    this.framesHash = murmurHash128(this.positionalStackTrace())
  }

  addTraceEvent (info) {
    switch (info.event) {
      case 'init':
        this.type = info.type
        this.init = info.timestamp
        this.triggerAsyncId = info.triggerId
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

  stackTrace () {
    const formattedFrames = this.frames.map(function (frame) {
      let name = frame.functionName ? frame.functionName : '<anonymous>'
      if (frame.isEval) {
        // no change
      } else if (frame.isToplevel) {
        // no change
      } else if (frame.isConstructor) {
        name = 'new ' + name
      } else if (frame.isNative) {
        name = 'native ' + name
      } else {
        name = frame.typeName + '.' + name
      }

      let formatted = '    at ' + name
      if (frame.isEval) {
        formatted += ' ' + frame.evalOrigin
      } else {
        formatted += ' ' + frame.fileName
        formatted += ':' + (frame.lineNumber > 0 ? frame.lineNumber : '')
        formatted += (frame.columnNumber > 0 ? ':' + frame.columnNumber : '')
      }

      return formatted
    })

    return formattedFrames.join('\n')
  }
}

module.exports = SourceNode
