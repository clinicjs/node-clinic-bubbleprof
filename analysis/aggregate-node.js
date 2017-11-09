'use strict'

const SourceNode = require('./source-node.js')

class AggregateNode {
  constructor(nodeId, parentNodeId) {
    this.nodeId = nodeId
    this.parentNodeId = parentNodeId
    this.children = []
    this.sources = []
  }

  makeRoot() {
    this.addSource(new SourceNode(1))
  }

  addChild(childNode) {
    this.children.push(childNode.nodeId)
  }

  getChildren() {
    return this.children.slice(0)
  }

  addSource(sourceNode) {
    this.sources.push(sourceNode)
  }

  getAsyncIds() {
    return this.sources.map((sourceNode) => sourceNode.asyncId)
  }
}

module.exports = AggregateNode
