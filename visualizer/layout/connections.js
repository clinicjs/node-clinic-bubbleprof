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
      // Leave a gap at both ends so any text labels are readable
      // Only one lineWidth because it increases distance by half a line width at each end
      this.scale.settings.labelMinimumSpace * 2 + this.scale.settings.lineWidth
  }
}

module.exports = Connection
