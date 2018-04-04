'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')

function getNodeAncestorIds (node) {
  const parent = node.getParentNode()
  return parent ? [...parent.stem.ancestors.ids, parent.id] : []
}

class Stem {
  constructor (node) {
    const parentNode = node.getParentNode()
    // Dynamic Stem assignment is necessary when working with subsets
    if (parentNode && !parentNode.stem) {
      parentNode.stem = new Stem(parentNode)
    }
    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      ids: getNodeAncestorIds(node)
    }
    this.ownBetween = node.getBetweenTime()
    this.ownDiameter = radiusFromCircumference(node.getWithinTime()) * 2

    for (const ancestorId of this.ancestors.ids) {
      const ancestor = node.getSameType(ancestorId)
      this.ancestors.totalBetween += ancestor.stem.ownBetween
      this.ancestors.totalDiameter += ancestor.stem.ownDiameter
    }
  }
  getTotalStemLength () {
    return this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter
  }
  static pickLeavesByLongest (nodes) {
    const byLongest = (leafA, leafB) => leafB.stem.getTotalStemLength() - leafA.stem.getTotalStemLength()
    const byLeafOnly = node => !node.children.length
    return nodes.filter(byLeafOnly).sort(byLongest)
  }
}

module.exports = Stem
