'use strict'

const { isNumber } = require('./validation.js')

function getNodeId (node) {
  return node.clusterId || node.aggregateId
}

function getNodeParentId (node) {
  return node.parentClusterId || node.parentAggregateId
}

function memoize (fn) {
  fn._cache = fn._cache || new Map()
  return (...args) => {
    if (fn._cache.get(args[0]) === undefined) {
      fn._cache.set(args[0], fn(...args))
    }
    return fn._cache.get(args[0])
  }
}

const getNodePath = memoize((node, nodeByType) => {
  const path = [getNodeId(node)]
  const ancestor = nodeByType[node.constructor.name].get(getNodeParentId(node))
  return ancestor ? getNodePath(ancestor, nodeByType).concat(path) : path
})

function calculateRadius (circumference) {
  return circumference / (2 * Math.PI)
}

class Stem {
  constructor (node, nodeByType) {
    this.pathToNode = getNodePath(node, nodeByType)
    this.ancestors = {
      totalBetween: 0,
      totalDiameter: 0,
      path: this.pathToNode.slice(0, -1)
    }
    // this.ownBetween = node.getStat('between') // TODO: uncomment as soon as averaging is implemented
    this.ownBetween = node.stats.async.between
    // this.ownDiameter = calculateRadius(node.getStat('within')) * 2 // TODO: uncomment as soon as averaging is implemented
    this.ownDiameter = calculateRadius(node.stats.async.within) * 2

    this._totalStemLengthByScale = {}

    for (let ancestor of this.ancestors.path) {
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
