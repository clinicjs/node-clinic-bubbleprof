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
    let fullName = ''
    let index = 0

    while (fullName.length < 24 && namesByPriority[index]) {
      if (index !== 0) fullName += ' & '
      fullName += truncateName(namesByPriority[index].name, fullName)
      index++
    }
    return namesByPriority.length > index ? fullName + ' & …' : fullName
  }

  getBetweenTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getBetweenTime(), 0)
  }

  getWithinTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getWithinTime(), 0)
  }

  /* istanbul ignore next: currently unused */
  getSyncTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getSyncTime(), 0)
  }

  /* istanbul ignore next: currently unused */
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

function truncateName (name, fullName) {
  const splitName = name.split(/(?=[+&>])/)
  const splitNameLength = splitName.length
  if (splitNameLength === 1) return trimName(splitName[0])

  // If there are multiple parts to a name, see if there's one that doesn't already appear in the name, e.g.
  // if fullName = `hapi & ` name = `hapi > podium` then `hapi & ...podium & ...` beats `hapi & hapi... & ...`
  for (let i = 0; i < splitNameLength; i++) {
    const subName = trimName(splitName[i])

    // Some names are like `... > someModule > anotherModule` from analysis branch
    // - Filter out '...' from analysis for main diagram (show in hover only).
    // - Add '…' to indicate contraction in draw branch, and don't filter it out.
    if ((subName) === '...') continue

    const prefix = i === 0 ? '' : '…'
    const suffix = i === splitNameLength - 1 ? '' : '…'
    if (!fullName.includes(subName)) return `${prefix}${subName}${suffix}`
  }
  return trimName(splitName[0]) + '…'
}

function trimName (name) {
  return name.replace(/([+&>])/g, '').trim()
}

module.exports = {
  LayoutNode,
  CollapsedLayoutNode
}
