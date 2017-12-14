'use strict'
const stream = require('stream')
const SourceNode = require('./source-node.js')

class CombineAsSourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._storage = new Map()
  }

  _transform (rawEvent, encoding, callback) {
    const { type, info } = rawEvent
    const asyncId = info.asyncId

    // add sourceNode if necessary
    if (!this._storage.has(asyncId)) {
      this._storage.set(asyncId, new SourceNode(asyncId))
    }

    // add info to sourceNode
    const sourceNode = this._storage.get(asyncId)
    if (type === 'stackTrace') {
      sourceNode.addStackTrace(info)
    } else if (type === 'traceEvent') {
      sourceNode.addTraceEvent(info)
    }

    // push sourceNode if complete and cleanup
    if (sourceNode.isComplete()) {
      this._storage.delete(asyncId)
      this.push(sourceNode)
    }

    callback(null)
  }

  _flush (callback) {
    // push incomplete nodes and cleanup
    for (const [asyncId, sourceNode] of this._storage) {
      this._storage.delete(asyncId)
      this.push(sourceNode)
    }

    callback(null)
  }
}

module.exports = CombineAsSourceNodes
