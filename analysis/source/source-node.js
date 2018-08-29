'use strict'

const util = require('util')
const crypto = require('crypto')
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
           ` identifier:${options.stylize(this.identifier && this.hash().slice(0, 16), 'special')}>`
  }

  hash () {
    return this.identifier && crypto.createHash('sha256').update(this.identifier).digest('hex')
  }

  toJSON ({ short } = { short: false }) {
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
    this.identifier = identifier
  }

  setParentAsyncId (asyncId) {
    this.parentAsyncId = asyncId
  }

  addRawEvent (rawEvent) {
    if (!(rawEvent instanceof RawEvent)) {
      throw new TypeError('addRawEvent input must be a RawEvent instance')
    }

    switch (rawEvent.type) {
      case 'stackTrace':
        this.addStackTrace(rawEvent.info)
        break
      case 'traceEvent':
        this.addTraceEvent(rawEvent.info)
        break
      default:
        throw new Error('unknown RawEvent type value: ' + rawEvent.type)
    }
  }

  addStackTrace (stackTrace) {
    if (!(stackTrace instanceof StackTrace)) {
      throw new TypeError('addStackTrace input must be a StackTrace instance')
    }

    this.frames = stackTrace.frames
  }

  addTraceEvent (traceEvent) {
    if (!(traceEvent instanceof TraceEvent)) {
      throw new TypeError('addTraceEvent input must be a TraceEvent instance')
    }

    switch (traceEvent.event) {
      case 'init':
        this.type = traceEvent.type
        this.init = traceEvent.timestamp
        this.triggerAsyncId = traceEvent.triggerAsyncId
        this.executionAsyncId = traceEvent.executionAsyncId
        this.setParentAsyncId(traceEvent.triggerAsyncId)
        break
      case 'destroy':
        this.destroy = traceEvent.timestamp
        break
      case 'before':
        this.before.push(traceEvent.timestamp)
        break
      case 'after':
        this.after.push(traceEvent.timestamp)
        break
      default:
        throw new Error('unknown TraceEvent type value: ' + traceEvent.event)
    }
  }

  isComplete () {
    return (this.hasStackTrace() &&
            this.init !== null &&
            this.destroy !== null &&
            this.before.length === this.after.length)
  }

  hasStackTrace () {
    return this.frames !== null
  }
}

module.exports = SourceNode
