'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')
const { validateNumber } = require('../validation.js')

function getNodeAncestorIds (parent) {
  return parent ? [...parent.stem.ancestors.ids, parent.id] : []
}

class Stem {
  constructor (layout, layoutNode) {
    this.layout = layout
    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      ids: getNodeAncestorIds(layoutNode.parent)
    }
    this.leaves = {
      ids: []
    }
    this.ownBetween = layoutNode.getBetweenTime()
    this.ownDiameter = radiusFromCircumference(layoutNode.getWithinTime()) * 2

    for (const ancestorId of this.ancestors.ids) {
      const ancestorStem = layout.layoutNodes.get(ancestorId).stem
      this.ancestors.totalBetween += ancestorStem.ownBetween
      this.ancestors.totalDiameter += ancestorStem.ownDiameter
      if (!layoutNode.children.length) {
        ancestorStem.leaves.ids.push(layoutNode.id)
      }
    }
    this.update()
  }
  update () {
    if (!this.lengths) {
      const absolute = ((this.layout.settings.labelMinimumSpace * 2) + this.layout.settings.lineWidth) * this.ancestors.ids.length
      const scalable = this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter
      this.lengths = {
        absolute: validateNumber(absolute, this.getValidationMessage()),
        scalable: validateNumber(scalable, this.getValidationMessage()),
        rawTotal: absolute + scalable
      }
    }
    if (this.layout.scale.scaleFactor) {
      const { settings, scale } = this.layout
      this.scaled = {
        ownBetween: (settings.labelMinimumSpace * 2) + settings.lineWidth + scale.getLineLength(this.ownBetween),
        ownDiameter: scale.getLineLength(this.ownDiameter)
      }
    }
  }
  getValidationMessage () {
    return `for stem with:
    ancestor ids [${this.ancestors.ids.join(', ')}], length ${this.ancestors.ids.length});
    leaves [${this.leaves.ids.join(', ')}], length ${this.leaves.ids.length};
    `
  }
  static pickLeavesByLongest (layoutNodes) {
    const byLongest = (leafA, leafB) => leafB.stem.lengths.rawTotal - leafA.stem.lengths.rawTotal
    const byLeafOnly = layoutNode => !layoutNode.children.length
    return [...layoutNodes.values()].filter(byLeafOnly).sort(byLongest)
  }
}

module.exports = Stem
