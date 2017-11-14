'use strict'

const SourceNode = require('./source-node.js')

class AggregateNode {
  constructor (nodeId, parentNodeId) {
    this.nodeId = nodeId
    this.parentNodeId = parentNodeId
    this.children = []
    this.sources = []
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
