'use strict'

const SourceNode = require('../source/source-node.js')

class AggregateNode {
  constructor (nodeId, parentNodeId) {
    this.nodeId = nodeId
    this.parentNodeId = parentNodeId
    this.children = []
    this.sources = []

    this.mark = null
    this.type = null
    this.frames = null
  }

  toJSON () {
    return {
      nodeId: this.nodeId,
      parentNodeId: this.parentNodeId,
      children: this.children,
      mark: this.mark,
      type: this.type,
      frames: this.frames,
      // frames and type are the same for all SourceNode's, so remove them
      // from the SourceNode data.
      sources: this.sources.map(function (source) {
        return {
          asyncId: source.asyncId,
          parentAsyncId: source.parentAsyncId,
          triggerAsyncId: source.triggerAsyncId,
          executionAsyncId: source.executionAsyncId,
          init: source.init,
          before: source.before,
          after: source.after,
          destroy: source.destroy
        }
      })
    }
  }

  setMark (mark) {
    this.mark = mark
  }

  makeRoot () {
    this.addSourceNode(new SourceNode(1))
    this.setMark('root')
  }

  addChild (nodeId) {
    this.children.push(nodeId)
  }

  getChildren () {
    return this.children
  }

  addSourceNode (sourceNode) {
    if (this.sources.length === 0) {
      this.type = sourceNode.type
      this.frames = sourceNode.frames
    }

    this.sources.push(sourceNode)
  }

  getSourceNodes (sourceNode) {
    return this.sources
  }
}

module.exports = AggregateNode
