'use strict'

class Connection {
  constructor (sourceNode, targetNode, scale) {
    this.sourceId = sourceNode.id
    this.sourceNode = sourceNode

    this.targetId = targetNode.id
    this.targetNode = targetNode

    this.scale = scale

    targetNode.connectionFromParent = this
  }

  // Avoid duplication of values so stats can be swtiched/recalculated with settings
  // If recalculating these proves to be a performance problem, consider caching values
  getSourceRadius () { return this.scale.getCircleRadius(this.sourceNode.getWithinTime()) }
  getTargetRadius () { return this.scale.getCircleRadius(this.targetNode.getWithinTime()) }
  getVisibleLineLength () { return this.scale.getLineLength(this.targetNode.getBetweenTime()) }
  getDistanceBetweenCenters () {
    return this.getSourceRadius() +
      this.getVisibleLineLength() +
      this.getTargetRadius() +
      this.scale.settings.labelMinimumSpace * 2 + // gap so any text labels are readable at both ends
      this.scale.settings.lineWidth // distance from radius to edge of visible circle = half a line width
      //                               half a line width at each end = one line width in total
  }
}

module.exports = Connection
