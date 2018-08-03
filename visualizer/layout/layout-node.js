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
    const namesByPriority = this.getNamesByPriority(dataNodes)
    this.node.name = this.getCollapsedName(namesByPriority)

    // Create new mark to avoid modifying the mark of the node this was based on
    this.node.mark = new Map().set('party', namesByPriority[0].party)
  }
  getNamesByPriority (dataNodes) {
    // Where names appear multiple times, reduce down to one total for that name
    const nodeNamesMap = dataNodes.reduce((namesMap, dataNode) => {
      const party = dataNode.mark.get('party')
      const time = dataNode.getTotalTime()
      const key = dataNode.name + '---' + party

      if (namesMap.has(key)) {
        namesMap.get(key).total += time
      } else {
        namesMap.set(key, {
          name: dataNode.name,
          total: time,
          party: party
        })
      }
      return namesMap
    }, new Map())

    return [...nodeNamesMap.values()].sort((a, b) => {
      return getWeightedNameTime(b) - getWeightedNameTime(a)
    })
  }
  getCollapsedName (namesByPriority) {
    let name = `${truncateName(namesByPriority[0].name)}`
    let index = 1
    while (name.length < 24 && namesByPriority[index]) {
      name += ` & ${truncateName(namesByPriority[index].name)}`
      index++
    }
    return namesByPriority.length > index ? name + ' & …' : name
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
function getWeightedNameTime (nameData) {
  const nameTime = nameData.total
  switch (nameData.party) {
    case 'user':
      return nameTime
    case 'external':
      return nameTime * 0.66
    default: // nodecore and user
      return nameTime * 0.33
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
