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
    this.leaves = {
      ids: []
    }
    this.ownBetween = node.getBetweenTime()
    this.ownDiameter = radiusFromCircumference(node.getWithinTime()) * 2

    for (const ancestorId of this.ancestors.ids) {
      const ancestor = node.getSameType(ancestorId)
      this.ancestors.totalBetween += ancestor.stem.ownBetween
      this.ancestors.totalDiameter += ancestor.stem.ownDiameter
      ancestor.stem.leaves.ids.push(node.id)
    }
  }
  getScaled (scale) {
    return {
      ownBetween: (scale.settings.labelMinimumSpace * 2) + scale.settings.lineWidth + scale.getLineLength(this.ownBetween),
      ownDiameter: scale.getLineLength(this.ownDiameter)
    }
  }
  getTotalStemLength (scale) {
    const scaledExtras = ((scale.settings.labelMinimumSpace * 2) + scale.settings.lineWidth) * this.ancestors.ids.length
    return this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter + scaledExtras
  }
  static pickLeavesByLongest (nodes, scale) {
    const byLongest = (leafA, leafB) => leafB.stem.getTotalStemLength(scale) - leafA.stem.getTotalStemLength(scale)
    const byLeafOnly = node => !node.children.length
    return nodes.filter(byLeafOnly).sort(byLongest)
  }
}

module.exports = Stem
