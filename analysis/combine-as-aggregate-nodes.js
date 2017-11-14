'use strict'
const stream = require('stream')
const AggregateNode = require('./aggregate-node.js')

class CombineAsAggregateNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    // Index incomming SourceNode by their triggerAsyncId. This will tell
    // what parent SourceNode they have, which is necessary information to
    // build the aggregated tree.
    this._triggerAsyncIdIndex = new Map()

    // the root node as nodeId = 1
    const root = new AggregateNode(1, 0)
    root.makeRoot()

    // maintain a map of nodes such nodeIds can be translated to AggregateNode
    // objects
    this._nodeId = 2
    this._aggregateNodes = new Map()
    this._aggregateNodes.set(root.nodeId, root)
  }

  _newAggregateNode (parentNode) {
    const childNode = new AggregateNode(this._nodeId++, parentNode.nodeId)
    this._aggregateNodes.set(childNode.nodeId, childNode)
    return childNode
  }

  _transform (node, encoding, callback) {
    if (this._triggerAsyncIdIndex.has(node.triggerAsyncId)) {
      this._triggerAsyncIdIndex.get(node.triggerAsyncId).push(node)
    } else {
      this._triggerAsyncIdIndex.set(node.triggerAsyncId, [node])
    }

    callback(null)
  }

  _findAndAssignChildren (parentNode) {
    const frameHashIndex = new Map()

    // get SourceNode belonging to the parent AggregateNode
    for (const parentSourceNode of parentNode.getSourceNodes()) {
      if (!this._triggerAsyncIdIndex.has(parentSourceNode.asyncId)) {
        continue
      }

      // check children of current sourceNode of the AggregateNode
      const children = this._triggerAsyncIdIndex.get(parentSourceNode.asyncId)
      for (const childSourceNode of children) {
        // if this is a new frameHash create a new AggregateNode for it
        if (!frameHashIndex.has(childSourceNode.framesHash)) {
          const childNode = this._newAggregateNode(parentNode)
          frameHashIndex.set(childSourceNode.framesHash, childNode)
          parentNode.addChild(childNode.nodeId)
        }

        // add SourceNode child to the new AggregateNode object
        frameHashIndex.get(childSourceNode.framesHash)
          .addSourceNode(childSourceNode)
      }
    }
  }

  _flush (callback) {
    // basic non-recursive BFS (breadth-first-search)
    const queue = [1] // root has nodeId = 1
    while (queue.length > 0) {
      // get node from queue and assign children to it
      const nodeId = queue.shift()
      const node = this._aggregateNodes.get(nodeId)
      this._findAndAssignChildren(node)

      // once a node has been assigned all its children, no more mutations
      // will be done to the object. It can thus be pushed to the next stream.
      this.push(node)

      // Add children of the newly updated node to the queue
      queue.push(...node.getChildren())
    }

    callback(null)
  }
}

module.exports = CombineAsAggregateNodes
