'use strict'
const stream = require('stream')
const BarrierNode = require('./barrier-node.js')

class MakeSynchronousBarrierNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._systemInfo = systemInfo
    this._barrierIdRewrite = new Map()
    this._storage = new Map()
  }

  _processNode(node) {
    // scan children for possible merges
    const maybeMerges = new Map()
    for (const childBarrierId of node.children) {
      const childBarrierNode = this._storage.get(childBarrierId)

      // don't merge child Barriernodes that are already merged
      if (!childBarrierNode.isWrapper) continue

      // get the first user call site
      const userFrames = childBarrierNode.unwrapNode()
        .frames.filter((frame) => !frame.isExternal(this._systemInfo))

      // don't merge if there are no user frames
      if (userFrames.length === 0) continue

      // make the first call site the split point
      const userCallSite = userFrames.pop()
      if (!maybeMerges.has(userCallSite.getPosition())) {
        maybeMerges.set(userCallSite.getPosition(), [ childBarrierNode ])
      } else {
        maybeMerges.get(userCallSite.getPosition()).push( childBarrierNode )
      }
    }

    // make merges
    for (const sameSourceChildren of maybeMerges.values()) {
      // if there is only one child, there is no need to merge
      if (sameSourceChildren.length === 1) continue

      // All node.children are guaranteed to be in stroage
      const newChildBarrierNode = node.combineChildren(sameSourceChildren)

      // Remove children from storage and log them as rewrites
      for (const sameSourceChild of sameSourceChildren) {
        this._storage.delete(sameSourceChild.barrierId)

        // Note that the newChildBarrierNode will reuse one of the existing
        // barrierIds. Thus one of these mapping will just be a noop.
        this._barrierIdRewrite.set(
          sameSourceChild.barrierId, newChildBarrierNode.barrierId
        )
      }

      // Add the new childNode to storage
      this._storage.set(newChildBarrierNode.barrierId, newChildBarrierNode)
    }
  }

  _transform (node, encoding, callback) {
    this._storage.set(node.barrierId, node)

    // root have no parents
    if (node.isRoot) return callback(null)

    // check if parentBarrierId have been remapped. If so update
    // the parrentBarrierId
    if (this._barrierIdRewrite.has(node.parentBarrierId)) {
      node.parentBarrierId = this._barrierIdRewrite.get(node.parentBarrierId)
    }

    // check if parent have all children avaliable in storage
    // The order is BFS, so the parrent is guaranteed to be in stroage
    const parentNode = this._storage.get(node.parentBarrierId)
    const allSiblingsInStorage = parentNode.children
      .every((childNode) => this._storage.has(childNode))
    if (allSiblingsInStorage) {
      this._processNode(parentNode)
      // It is technically possible to emit the parentNode at this point. The
      // problem is that leaf nodes are never parrents, thus they won't be
      // emitted correctly. It is theoretically possible to work arround this,
      // but it is quite compilicated. Since all nodes are in memory anyway,
      // just dump out the tree in _flush.
    }

    callback(null)
  }

  _flush(callback) {
    // basic non-recursive BFS (breadth-first-search)
    const queue = [1] // root has barrierId = 1
    while (queue.length > 0) {
      const barrierNode = this._storage.get(queue.shift())
      this.push(barrierNode)

      // Add children of the newly updated node to the queue
      queue.push(...barrierNode.children)
    }

    callback(null)
  }
}

module.exports = MakeSynchronousBarrierNodes
