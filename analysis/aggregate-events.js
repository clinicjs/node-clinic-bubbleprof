'use strict'
const stream = require('stream')
const AggregateNode = require('./aggregate-node.js')

class AggregateEvents extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._triggerAsyncIdIndex = new Map()

    this._nodeId = 1

    const root = new AggregateNode(this._nodeId++, 0)
    root.makeRoot()
    this._nodes = new Map()
    this._nodes.set(root.nodeId, root)
  }

  _newAggregateNode(parent) {
    const childNode = new AggregateNode(this._nodeId++, parent.nodeId)
    this._nodes.set(childNode.nodeId, childNode)
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

  _addChildren(parent) {
    const forwardPaths = new Map()

    for (const parentSourceAsyncId of parent.getAsyncIds()) {
      if (!this._triggerAsyncIdIndex.has(parentSourceAsyncId)) {
          continue
      }

      const children = this._triggerAsyncIdIndex.get(parentSourceAsyncId)

      for (const childSource of children) {
        if (!forwardPaths.has(childSource.framesHash)) {
          const childNode = this._newAggregateNode(parent)
          forwardPaths.set(childSource.framesHash, childNode)
          parent.addChild(childNode)
        }

        forwardPaths.get(childSource.framesHash).addSource(childSource)
      }
    }
  }

  _flush (callback) {
    const queue = [1]

    while (queue.length > 0) {
      const nodeId = queue.shift()
      const node = this._nodes.get(nodeId)
      this._addChildren(node)
      this.push(node)
      queue.push(...node.getChildren())
    }

    callback(null)
  }
}

module.exports = AggregateEvents
