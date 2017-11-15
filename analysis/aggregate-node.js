'use strict'

const SourceNode = require('./source-node.js')

class AggregateNode {
  constructor (nodeId, parentNodeId) {
    this.nodeId = nodeId
    this.parentNodeId = parentNodeId
    this.children = []
    this.sources = []
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      parentNodeId: this.parentNodeId,
      children: this.children,
      // frames and type are the same for all SourceNode's, so remove them
      // from the SourceNode data.
      frames: this.sources[0].frames,
      type: this.sources[0].type,
      sources: this.sources.map(function (source) {
        return {
          asyncId: source.asyncId,
          triggerAsyncId: source.triggerAsyncId,
          init: source.init,
          before: source.before,
          after: source.after,
          destroy: source.destroy
        }
      })
    }
  }

  makeRoot () {
    this.addSourceNode(new SourceNode(1))
  }

  addChild (nodeId) {
    this.children.push(nodeId)
  }

  getChildren () {
    return this.children
  }

  addSourceNode (sourceNode) {
    this.sources.push(sourceNode)
  }

  getSourceNodes (sourceNode) {
    return this.sources
  }
}

module.exports = AggregateNode
