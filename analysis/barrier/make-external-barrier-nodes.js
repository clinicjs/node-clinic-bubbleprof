'use strict'
const stream = require('stream')

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

  _transform (barrierNode, encoding, callback) {
    // Root is always in user scope
    if (barrierNode.isRoot) {
      this._placementStorage.set(barrierNode.barrierId, USER)
      return callback(null, barrierNode)
    }

    // If the node is already a barrier, there is no need to make it a barrier
    // again.
    let foundInternalNodes = false
    let foundExternalNodes = false
    for (const aggregateNode of barrierNode.nodes) {
      // If there are no frames, .every will still return true
      const isExternal = aggregateNode.frames
        .every((frame) => frame.isExternal(this._systemInfo))

      if (isExternal) foundExternalNodes = true
      else foundInternalNodes = true
    }

    if (foundInternalNodes && foundExternalNodes) {
      this._placementStorage.set(barrierNode.barrierId, BOTH)
    } else if (foundExternalNodes) {
      this._placementStorage.set(barrierNode.barrierId, EXTERNAL)
    } else {
      this._placementStorage.set(barrierNode.barrierId, USER)
    }

    // The node is already a barrier, no point in making it a barrier again
    // This also means we don't have to handle the case where this BarrierNode
    // is placed in both scopes.
    if (!barrierNode.isWrapper) {
      return callback(null, barrierNode)
    }

    // Make it a barrier by comparing placement of this node and its parrent
    const parentPlacement = this._placementStorage.get(barrierNode.parentBarrierId)
    const placement = this._placementStorage.get(barrierNode.barrierId)

    // If the parent is placed both scopes, don't make this a wrapper
    // NOTE: we currently don't have a case where this can be true, so
    // it is hard to think about what makes sense.
    if (parentPlacement === BOTH) {
      return callback(null, barrierNode)
    }

    // If it changed from external to internal, or from internal to external (XOR)
    // Then make this BarrierNode a real barrier.
    if ((placement === EXTERNAL) ^ (parentPlacement === EXTERNAL)) {
      barrierNode.makeBarrier()
    }

    return callback(null, barrierNode)
  }
}

module.exports = MakeSynchronousBarrierNodes
