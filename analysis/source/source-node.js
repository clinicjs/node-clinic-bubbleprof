'use strict'

const util = require('util')
const Frames = require('./frames.js')
const { murmurHash128 } = require('murmurhash-native')

class SourceNode {
  constructor (asyncId) {
    this.asyncId = asyncId
    this.identifier = null

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

  setIdentifier (identifier) {
    this.identifier = murmurHash128(identifier)
  }

  setParentAsyncId (asyncId) {
    this.parentAsyncId = asyncId
  }

  addStackTrace (info) {
    this.frames = new Frames(info.frames)
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
    return this.frames.map((frame) => frame.getPosition()).join('\n')
  }
}

module.exports = SourceNode
