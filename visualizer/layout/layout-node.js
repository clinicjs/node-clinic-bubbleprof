'use strict'

const { validateNumber } = require('../validation.js')
const { ArtificialNode } = require('../data/data-node.js')

class LayoutNode {
  constructor (node, parent) {
    this.id = node.id
    this.node = node
    this.stem = null
    this.position = null
    this.inboundConnection = null
    this.parent = parent
    this.children = []
  }
  getBetweenTime () {
    return this.node.getBetweenTime()
  }
  getWithinTime () {
    return this.node.getWithinTime()
  }
  getTotalTime () {
    return this.getBetweenTime() + this.getWithinTime()
  }
  validateStat (...args) {
    return this.node.validateStat(...args)
  }
}

class CollapsedLayoutNode {
  constructor (layoutNodes, parent, children) {
    this.id = 'clump:' + layoutNodes.sort((a, b) => a.id - b.id).map(layoutNode => layoutNode.id).join(',')
    this.collapsedNodes = layoutNodes
    this.parent = parent
    this.children = children || []

    for (let i = 0; i < layoutNodes.length; ++i) {
      const layoutNode = layoutNodes[i]
      const node = layoutNode.node
      if (!this.node) {
        this.node = new ArtificialNode({
          id: this.id,
          nodeType: node.constructor.name
        }, node)
      }
      if (node.nodes) this.node.applyAggregateNodes(node.nodes)
      this.node.applyMark(node.mark)
      this.node.aggregateStats(node)
      this.applyDecimals(node)
    }
  }
  getBetweenTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getBetweenTime(), 0)
  }
  getWithinTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getWithinTime(), 0)
  }
  getSyncTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getSyncTime(), 0)
  }
  getAsyncTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getAsyncTime(), 0)
  }
  getTotalTime () {
    return this.getBetweenTime() + this.getWithinTime()
  }
  validateStat (num, statType = '', aboveZero = false) {
    const targetDescription = `For ${this.constructor.name} ${this.id}${statType ? ` ${statType}` : ''}`
    return validateNumber(num, targetDescription, aboveZero)
  }
  applyDecimals (otherNode) {
    this.node.aggregateDecimals(otherNode, 'type', 'between')
    this.node.aggregateDecimals(otherNode, 'type', 'within')
    this.node.aggregateDecimals(otherNode, 'typeCategory', 'between')
    this.node.aggregateDecimals(otherNode, 'typeCategory', 'within')
    this.node.aggregateDecimals(otherNode, 'party', 'between')
    this.node.aggregateDecimals(otherNode, 'party', 'within')
  }
}

module.exports = {
  LayoutNode,
  CollapsedLayoutNode
}
