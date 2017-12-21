'use strict'
const stream = require('stream')
const AggregateNode = require('./aggregate-node.js')

class CombineAsAggregateNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    // Index incomming SourceNode by their parentAsyncId. This will tell
    // what parent SourceNode they have, which is necessary information to
    // build the aggregated tree.
    this._parentAsyncIdIndex = new Map()

    // the root node as aggregateId = 1
    const root = new AggregateNode(1, 0)
    root.makeRoot()

    // maintain a map of nodes such aggregateIds can be translated to AggregateNode
    // objects
    this._aggregateId = 2
    this._aggregateNodes = new Map()
    this._aggregateNodes.set(root.aggregateId, root)
  }

  _newAggregateNode (parentAggregateNode) {
    const childNode = new AggregateNode(
      this._aggregateId++, parentAggregateNode.aggregateId
    )
    this._aggregateNodes.set(childNode.aggregateId, childNode)
    return childNode
  }

  _transform (sourceNode, encoding, callback) {
    if (this._parentAsyncIdIndex.has(sourceNode.parentAsyncId)) {
      this._parentAsyncIdIndex.get(sourceNode.parentAsyncId).push(sourceNode)
    } else {
      this._parentAsyncIdIndex.set(sourceNode.parentAsyncId, [sourceNode])
    }

    callback(null)
  }

  _findAndAssignChildren (parentAggregateNode) {
    const identifierIndex = new Map()

    // get SourceNode belonging to the parent AggregateNode
    for (const parentSourceNode of parentAggregateNode.getSourceNodes()) {
      if (!this._parentAsyncIdIndex.has(parentSourceNode.asyncId)) {
        continue
      }

      // check children of current sourceNode of the AggregateNode
      const children = this._parentAsyncIdIndex.get(parentSourceNode.asyncId)
      for (const childSourceNode of children) {
        // if this is a new identifier create a new AggregateNode for it
        if (!identifierIndex.has(childSourceNode.identifier)) {
          const childNode = this._newAggregateNode(parentAggregateNode)
          identifierIndex.set(childSourceNode.identifier, childNode)
          parentAggregateNode.addChild(childNode.aggregateId)
        }

        // add SourceNode child to the new AggregateNode object
        identifierIndex.get(childSourceNode.identifier)
          .addSourceNode(childSourceNode)
      }
    }
  }

  _flush (callback) {
    // basic non-recursive BFS (breadth-first-search)
    const queue = [1] // root has aggregateId = 1
    while (queue.length > 0) {
      // get node from queue and assign children to it
      const aggregateId = queue.shift()
      const aggregateNode = this._aggregateNodes.get(aggregateId)
      this._findAndAssignChildren(aggregateNode)

      // once a node has been assigned all its children, no more mutations
      // will be done to the object. It can thus be pushed to the next stream.
      this.push(aggregateNode)

      // Add children of the newly updated node to the queue
      queue.push(...aggregateNode.getChildren())
    }

    callback(null)
  }
}

module.exports = CombineAsAggregateNodes
