'use strict'
const stream = require('stream')

class SourceNode {
  constructor(asyncId) {
    this.asyncId = asyncId

    // parent
    this.triggerAsyncId = null

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

  addStackTrace(info) {
    this.frames = info.frames
  }

  addTraceEvent(info) {
    switch (info.event) {
      case 'init':
        this.type = info.type
        this.init = info.timestamp
        this.triggerAsyncId = info.triggerId
        break;
      case 'destroy':
        this.destroy = info.timestamp
        break;
      case 'before':
        this.before.push(info.timestamp)
        break;
      case 'after':
        this.after.push(info.timestamp)
        break;
    }
  }

  isComplete() {
    return (this.hasStackTrace() &&
            this.destroy !== null &&
            this.before.length === this.after.length)
  }

  hasStackTrace() {
    return this.frames !== null;
  }
}

class CollapseEvents extends stream.Transform {
  constructor() {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._nodes = new Map()
  }

  _transform(data, encoding, callback) {
    const { type, info } = data;
    const asyncId = info.asyncId;

    // add node if necessary
    if (!this._nodes.has(asyncId)) {
      this._nodes.set(asyncId, new SourceNode(asyncId))
    }

    // add info to node
    const node = this._nodes.get(asyncId)
    if (type === 'stackTrace') {
      node.addStackTrace(info)
    } else if (type === 'traceEvents') {
      node.addTraceEvent(info)
    }

    // push node if complete and cleanup
    if (node.isComplete()) {
      this._nodes.delete(asyncId)
      this.push(node)
    }

    callback(null)
  }

  _flush(callback) {
    // push incomplete nodes and cleanup
    for (const [asyncId, node] of this._nodes) {
      this._nodes.delete(asyncId)
      this.push(node)
    }

    callback(null)
  }
}

module.exports = CollapseEvents
