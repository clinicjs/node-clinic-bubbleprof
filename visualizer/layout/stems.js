'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')

function getNodeAncestorIds (parent) {
  return parent ? [...parent.stem.ancestors.ids, parent.node.id] : []
}

class Stem {
  constructor (layout, layoutNode) {
    this.layout = layout
    const node = layoutNode.node

    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      ids: getNodeAncestorIds(layoutNode.parent)
    }
    this.leaves = {
      ids: []
    }
    this.ownBetween = node.getBetweenTime()
    this.ownDiameter = radiusFromCircumference(node.getWithinTime()) * 2

    for (const ancestorId of this.ancestors.ids) {
      const ancestorStem = layout.layoutNodes.get(ancestorId).stem
      this.ancestors.totalBetween += ancestorStem.ownBetween
      this.ancestors.totalDiameter += ancestorStem.ownDiameter
      if (!node.children.length) {
        ancestorStem.leaves.ids.push(node.id)
      }
    }
  }
  getScaled (scale) {
    return {
      ownBetween: (this.layout.settings.labelMinimumSpace * 2) + this.layout.settings.lineWidth + scale.getLineLength(this.ownBetween),
      ownDiameter: scale.getLineLength(this.ownDiameter)
    }
  }
  getTotalStemLength () {
    const absolute = ((this.layout.settings.labelMinimumSpace * 2) + this.layout.settings.lineWidth) * this.ancestors.ids.length
    const scalable = this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter
    return {
      absolute,
      scalable,
      combined: absolute + scalable
    }
  }
  static pickLeavesByLongest (layoutNodes) {
    const byLongest = (leafA, leafB) => leafB.stem.getTotalStemLength().combined - leafA.stem.getTotalStemLength().combined
    const byLeafOnly = layoutNode => !layoutNode.node.children.length
    return [...layoutNodes.values()].filter(byLeafOnly).sort(byLongest)
  }
}

module.exports = Stem
