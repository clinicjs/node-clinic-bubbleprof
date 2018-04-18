'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')
const { validateNumber } = require('../validation.js')

function getNodeAncestorIds (parent) {
  return parent ? [...parent.stem.ancestors.ids, parent.id] : []
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
      if (!layoutNode.children.length) {
        ancestorStem.leaves.ids.push(node.id)
      }
    }
  }
  getScaled (scale) {
    const ownBetween = (this.layout.settings.labelMinimumSpace * 2) + this.layout.settings.lineWidth + scale.getLineLength(this.ownBetween)
    const ownDiameter = scale.getLineLength(this.ownDiameter)
    return {
      ownBetween: validateNumber(ownBetween, this.getValidationMessage()),
      ownDiameter: validateNumber(ownDiameter, this.getValidationMessage())
    }
  }
  getTotalStemLength () {
    const absolute = ((this.layout.settings.labelMinimumSpace * 2) + this.layout.settings.lineWidth) * this.ancestors.ids.length
    const scalable = this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter
    return {
      absolute: validateNumber(absolute, this.getValidationMessage()),
      scalable: validateNumber(scalable, this.getValidationMessage()),
      combined: absolute + scalable
    }
  }
  getValidationMessage () {
    return `for stem with:
    ancestor ids [${this.ancestors.ids.join(', ')}], length ${this.ancestors.ids.length});
    leaves [${this.leaves.ids.join(', ')}], length ${this.leaves.ids.length};
    `
  }
  static pickLeavesByLongest (layoutNodes) {
    const byLongest = (leafA, leafB) => leafB.stem.getTotalStemLength().combined - leafA.stem.getTotalStemLength().combined
    const byLeafOnly = layoutNode => !layoutNode.children.length
    return [...layoutNodes.values()].filter(byLeafOnly).sort(byLongest)
  }
}

module.exports = Stem
