'use strict'

const { isNumber } = require('./validation.js')

function getNodeParentId (node) {
  return node.parentClusterId || node.parentAggregateId
}

function getNodePath (node, nodeByType) {
  const parent = nodeByType[node.constructor.name].get(getNodeParentId(node))
  return parent ? [...parent.stem.ancestors.ids, parent.id] : []
}

function calculateRadius (circumference) {
  return circumference / (2 * Math.PI)
}

class Stem {
  constructor (node, nodeByType) {
    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      ids: getNodePath(node, nodeByType)
    }
    // this.ownBetween = node.getStat('between') // TODO: uncomment as soon as averaging is implemented
    this.ownBetween = node.stats.async.between
    // this.ownDiameter = calculateRadius(node.getStat('within')) * 2 // TODO: uncomment as soon as averaging is implemented
    this.ownDiameter = calculateRadius(node.stats.async.within) * 2

    this._totalStemLengthByScale = {}

    for (let ancestor of this.ancestors.ids) {
      ancestor = nodeByType[node.constructor.name].get(ancestor)
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
}
