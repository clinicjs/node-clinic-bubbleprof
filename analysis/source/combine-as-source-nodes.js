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
    // create new sourceNode if necessary
    if (!this._storage.has(rawEvent.asyncId)) {
      this._storage.set(rawEvent.asyncId, new SourceNode(rawEvent.asyncId))
    }

    // add rawEvent to sourceNode
    const sourceNode = this._storage.get(rawEvent.asyncId)
    sourceNode.addRawEvent(rawEvent)

    // push sourceNode if complete and cleanup
    if (sourceNode.isComplete()) {
      this._storage.delete(rawEvent.asyncId)
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
