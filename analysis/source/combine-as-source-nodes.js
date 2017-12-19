'use strict'
const stream = require('stream')
const SourceNode = require('./source-node.js')

class CombineAsSourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._nodes = new Map()
  }

  _transform (data, encoding, callback) {
    const { type, info } = data
    const asyncId = info.asyncId

    // add node if necessary
    if (!this._nodes.has(asyncId)) {
      this._nodes.set(asyncId, new SourceNode(asyncId))
    }

    // add info to node
    const node = this._nodes.get(asyncId)
    if (type === 'stackTrace') {
      node.addStackTrace(info)
    } else if (type === 'traceEvent') {
      node.addTraceEvent(info)
    }

    // push node if complete and cleanup
    if (node.isComplete()) {
      this._nodes.delete(asyncId)
      this.push(node)
    }

    callback(null)
  }

  _flush (callback) {
    // push incomplete nodes and cleanup
    for (const [asyncId, node] of this._nodes) {
      this._nodes.delete(asyncId)
      this.push(node)
    }

    callback(null)
  }
}

module.exports = CombineAsSourceNodes
