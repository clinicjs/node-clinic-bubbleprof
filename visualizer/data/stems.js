'use strict'

const { isNumber } = require('./validation.js')

function getNodeAncestorIds (node) {
  const parent = node.getParentNode()
  return parent ? [...parent.stem.ancestors.ids, parent.id] : []
}

function calculateRadius (circumference) {
  return circumference / (2 * Math.PI)
}

class Stem {
  constructor (node) {
    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      ids: getNodeAncestorIds(node)
    }
    this.ownBetween = node.getBetweenTime()
    this.ownDiameter = calculateRadius(node.getWithinTime()) * 2

    this._totalStemLengthByScale = {}

    for (const ancestorId of this.ancestors.ids) {
      const ancestor = node.getSameType(ancestorId)
      this.ancestors.totalBetween += ancestor.stem.ownBetween
      this.ancestors.totalDiameter += ancestor.stem.ownDiameter
    }
  }
  getTotalStemLength (scale = 1) {
    if (!isNumber(this._totalStemLengthByScale[scale])) {
      // All lines and circumferences are meant to represent same value / pixel ratio => so simply multiply all by same scale
      this._totalStemLengthByScale[scale] = (this.ancestors.totalBetween + this.ancestors.totalDiameter + this.ownBetween + this.ownDiameter) * scale
    }
    return this._totalStemLengthByScale[scale]
  }
}

module.exports = {
  Stem
  // ClumpedPyramidLayout will be added and exported in delivery for ui-D2
}
