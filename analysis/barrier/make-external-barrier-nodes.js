'use strict'
const stream = require('stream')
const BarrierNode = require('./barrier-node.js')

const EXTERNAL = Symbol('external')
const USER = Symbol('user')
const BOTH = Symbol('both')

class MakeSynchronousBarrierNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._systemInfo = systemInfo
    this._placementStorage = new Map()
  }

  _transform (node, encoding, callback) {
    // Root is always in user scope
    if (node.isRoot) {
      this._placementStorage.set(node.barrierId, USER)
      return callback(null, node)
    }

    // If the node is already a barrier, there is no need to make it a barrier
    // again.
    let foundInternal = false
    let foundExternal = false
    for (const aggregateNode of node.nodes) {
      // If there are no frames, .every will still return true
      const isExternal = aggregateNode.frames
        .every((frame) => frame.isExternal(this._systemInfo))

      if (isExternal) foundExternal = true
      else foundInternal = true
    }

    if (foundInternal && foundExternal) {
      this._placementStorage.set(node.barrierId, BOTH)
    } else if (foundExternal) {
      this._placementStorage.set(node.barrierId, EXTERNAL)
    } else {
      this._placementStorage.set(node.barrierId, USER)
    }

    // The node is already a barrier, no point in making it a barrier again
    // This also means we don't have to handle the case where this BarrierNode
    // is placed in both scopes.
    if (!node.isWrapper) {
      return callback(null, node)
    }

    // Make it a barrier by comparing placement of this node and its parrent
    const parentPlacement = this._placementStorage.get(node.parentBarrierId)
    const placement = this._placementStorage.get(node.barrierId)

    // If the parent is placed both scopes, don't make this a wrapper
    // NOTE: we currently don't have a case where this can be true, so
    // it is hard to think about what makes sense.
    if (parentPlacement === BOTH) {
      return callback(null, node)
    }

    // If it changed from external to internal, or from internal to external (XOR)
    // Then make this BarrierNode a real barrier.
    if ((placement === EXTERNAL) ^ (parentPlacement === EXTERNAL)) {
      node.makeBarrier()
    }

    return callback(null, node)
  }
}

module.exports = MakeSynchronousBarrierNodes
