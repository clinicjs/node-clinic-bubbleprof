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
    const dataNodes = layoutNodes.map(layoutNode => layoutNode.node).sort(sortNodesByLargestTime)

    // Collapsed ids are for uniqueness and human inspection; sort ids into a human-readable order
    this.id = collapsedId

    this.collapsedNodes = layoutNodes
    this.parent = parent
    this.children = children || []

    const nodesByParty = {
      user: [],
      external: [],
      nodecore: []
    }

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
      this.node.applyMark(node.mark)
      this.node.aggregateStats(node)
      this.applyDecimals(node)
      const party = node.mark.get('party')
      nodesByParty[party === 'root' ? 'nodecore' : party].push(node)
    }
    const nodesByPriority = this.getNodesByPriority(nodesByParty, dataNodes)
    this.node.name = this.getCollapsedName(nodesByPriority)
  }
  getNodesByPriority (nodesByParty, dataNodes) {
    // Get the two most 'interesting' names from the collapsed set
    // Prioritise userland > external > nodecore, and boost relatively large nodes
    nodesByParty.user.sort(sortNodesByLargestTime)
    nodesByParty.external.sort(sortNodesByLargestTime)
    nodesByParty.nodecore.sort(sortNodesByLargestTime)

    const overallTime = this.getTotalTime()

    const node0 = dataNodes[0]
    const node0Time = node0.getTotalTime() / overallTime
    const node0Party = node0.mark.get('party')

    const dedupe = {}

    const nodesByPriority = [
      // Very large external or nodecore names push ahead of top userland (or external)
      node0Time >= 0.5 && node0Party === 'external' ? node0 : null,
      node0Time >= 0.6 && node0Party === 'nodecore' ? node0 : null,
      nodesByParty.user[0],
      nodesByParty.external[0],
      nodesByParty.nodecore[0],
      // Large external or nodecore names push out 2nd userland or external
      node0Time > 0.25 && node0Time < 0.5 && node0Party === 'external' ? node0 : null,
      node0Time > 0.3 && node0Time < 0.6 && node0Party === 'nodecore' ? node0 : null,
      nodesByParty.user[1],
      nodesByParty.external[1],
      nodesByParty.nodecore[1]
    ].filter(node => {
      // remove undefined and duplicates
      if (!node || dedupe[node.id]) return false
      dedupe[node.id] = true
      return true
    })
    return nodesByPriority
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

function sortNodesByLargestTime (a, b) {
  return b.getTotalTime() - a.getTotalTime()
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
