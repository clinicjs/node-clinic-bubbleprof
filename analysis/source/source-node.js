'use strict'

const util = require('util')
const { murmurHash128 } = require('murmurhash-native')
const Frames = require('../stack-trace/frames.js')
const StackTrace = require('../stack-trace/stack-trace.js')
const TraceEvent = require('../trace-event/trace-event.js')
const RawEvent = require('../raw-event/raw-event.js')

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
    return `<${options.stylize('SourceNode', 'special')}` +
           ` type:${options.stylize(this.type, 'string')},` +
           ` asyncId:${options.stylize(this.asyncId, 'number')},` +
           ` parentAsyncId:${options.stylize(this.parentAsyncId, 'number')},` +
           ` triggerAsyncId:${options.stylize(this.triggerAsyncId, 'number')},` +
           ` executionAsyncId:${options.stylize(this.executionAsyncId, 'number')},` +
           ` identifier:${options.stylize(this.identifier, 'special')}>`
  }

  toJSON ({short} = {short: false}) {
    const json = {
      asyncId: this.asyncId,
      parentAsyncId: this.parentAsyncId,
      triggerAsyncId: this.triggerAsyncId,
      executionAsyncId: this.executionAsyncId,

      init: this.init,
      before: this.before,
      after: this.after,
      destroy: this.destroy
    }

    if (!short) {
      json.identifier = this.identifier
      json.type = this.type
      json.frames = this.frames === null ? null : this.frames.toJSON()
    }

    return json
  }

  makeRoot () {
    this.frames = new Frames([])
  }

  setIdentifier (identifier) {
    this.identifier = murmurHash128(identifier)
  }

  setParentAsyncId (asyncId) {
    this.parentAsyncId = asyncId
  }

  addRawEvent (data) {
    if (!(data instanceof RawEvent)) {
      throw new TypeError('data must be a RawEvent instance')
    }

    switch (data.type) {
      case 'stackTrace':
        this.addStackTrace(data.info)
        break
      case 'traceEvent':
        this.addTraceEvent(data.info)
        break
      default:
        throw new Error('unknown RawEvent type value ' + data.type)
    }
  }

  addStackTrace (info) {
    if (!(info instanceof StackTrace)) {
      throw new Error('info must be a StackTrace instance')
    }

    if (!(info.frames instanceof Frames)) {
      throw new Error('stackTrace.frames must be a Frames instance')
    }

    this.frames = info.frames
  }

  addTraceEvent (info) {
    if (!(info instanceof TraceEvent)) {
      throw new Error('info must be a TraceEvent instance')
    }

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
