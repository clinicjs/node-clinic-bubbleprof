'use strict'
const stream = require('stream')

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

  _processNode (barrierNode) {
    // scan children for possible merges
    const maybeMerges = new Map()
    for (const childBarrierId of barrierNode.children) {
      const childBarrierNode = this._storage.get(childBarrierId)

      // don't merge child BarrierNodes that are already merged
      if (!childBarrierNode.isWrapper) continue

      // get the earliest user call site
      const aggregateNode = childBarrierNode.unwrapNode()
      const userFrames = aggregateNode.frames
        .filter((frame) => !frame.isExternal(this._systemInfo))

      // don't merge if there are no user frames
      if (userFrames.length === 0) continue

      // make the earliest call site the split point
      const userCallSite = userFrames.last()
      // Ensure that the new barrierNodes have the same aggregateNode parent.
      const mergeIdentifier = `${aggregateNode.parentAggregateId}\f${userCallSite.getPosition()}`
      if (!maybeMerges.has(mergeIdentifier)) {
        maybeMerges.set(mergeIdentifier, [childBarrierNode])
      } else {
        maybeMerges.get(mergeIdentifier).push(childBarrierNode)
      }
    }

    // make merges
    for (const sameSourceChildren of maybeMerges.values()) {
      // if there is only one child, there is no need to merge
      if (sameSourceChildren.length === 1) continue

      // All barrierNode.children are guaranteed to be in stroage
      const newChildBarrierNode = barrierNode.combineChildren(sameSourceChildren)

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

  _transform (barrierNode, encoding, callback) {
    this._storage.set(barrierNode.barrierId, barrierNode)

    // root have no parents
    if (barrierNode.isRoot) return callback(null)

    // check if parentBarrierId have been remapped. If so update
    // the parrentBarrierId
    if (this._barrierIdRewrite.has(barrierNode.parentBarrierId)) {
      barrierNode.updateParentBarrierId(
        this._barrierIdRewrite.get(barrierNode.parentBarrierId)
      )
    }

    // check if parent have all children avaliable in storage
    // The order is BFS, so the parrent is guaranteed to be in stroage
    const parentBarrierNode = this._storage.get(barrierNode.parentBarrierId)
    const allSiblingsInStorage = parentBarrierNode.children
      .every((childNode) => this._storage.has(childNode))
    if (allSiblingsInStorage) {
      this._processNode(parentBarrierNode)
      // It is technically possible to emit the parentBarrierNode at this point.
      // The problem is that leaf nodes are never parrents, thus they won't be
      // emitted correctly. It is theoretically possible to work arround this,
      // but it is quite compilicated. Since all nodes are in memory anyway,
      // just dump out the tree in _flush.
    }

    callback(null)
  }

  _flush (callback) {
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
