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
  constructor (collapsedId, layoutNodes, parent, children) {
    // layoutNodes should be an array sorted using layout.getLayoutNodeSorter()
    const dataNodes = layoutNodes.map(layoutNode => layoutNode.node)

    // Collapsed ids are for uniqueness and human inspection; sort ids into a human-readable order
    this.id = collapsedId

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
        }, node, dataNodes)
      }
      if (node.nodes) this.node.applyAggregateNodes(node.nodes)
      this.node.aggregateStats(node)
      this.applyDecimals(node)
    }
    const nodesByPriority = this.getNodesByPriority(dataNodes)
    this.node.name = this.getCollapsedName(nodesByPriority)
    this.node.mark = nodesByPriority[0].mark
  }
  getNodesByPriority (dataNodes) {
    return dataNodes.sort((a, b) => {
      return getWeightedNodeTime(b) - getWeightedNodeTime(a)
    })
  }
  getCollapsedName (nodesByPriority) {
    let name = `${truncateName(nodesByPriority[0].name)}`
    let index = 1
    while (name.length < 24 && nodesByPriority[index]) {
      name += ` & ${truncateName(nodesByPriority[index].name)}`
      index++
    }
    return nodesByPriority.length > index ? name + ' & …' : name
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
function getWeightedNodeTime (dataNode) {
  const nodeTime = dataNode.getTotalTime()
  switch (dataNode.mark.get('party')) {
    case 'user':
      return nodeTime
    case 'external':
      return nodeTime * 0.75
    default: // nodecore and user
      return nodeTime * 0.5
  }
}

function truncateName (name) {
  const splitName = name.split(/(?=[+&>])/)
  let newName = splitName[0].trim()
  if (newName === '...') newName = splitName[1].slice(1).trim()
  return splitName.length > 1 ? newName + '…' : newName
}

module.exports = {
  LayoutNode,
  CollapsedLayoutNode
}
