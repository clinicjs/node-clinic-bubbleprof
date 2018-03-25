'use strict'

class Connection {
  constructor (sourceNode, targetNode, scale) {
    this.sourceId = sourceNode.id
    this.sourceNode = sourceNode

    this.targetId = targetNode.id
    this.targetNode = targetNode

    this.scale = scale

    // TODO: add stems stuff if still needed here - getter for props set to nodes?

    targetNode.connectionFromParent = this
  }
  // TODO: .withinValue and .betweenValue below are undefined until ui-A3 branch merges
  //       This is included now as an illustrative example

  // Avoid duplication of values so stats can be swtiched/recalculated with settings
  // If recalculating these proves to be a performance problem, consider caching values
  get sourceRadius () { return scale.getCircleRadius(this.sourceNode.withinValue) }
  get targetRadius () { return scale.getCircleRadius(this.targetNode.withinValue) }
  get visibleLineLength () { return scale.getLineLength(this.targetNode.betweenValue) }
  get distanceBetweenCenters () {
    return this.sourceRadius +
      this.visibleLineLength +
      this.targetRadius +
      this.scale.settings.labelMinimumSpace * 2 + // gap so any text labels are readable at both ends
      this.scale.settings.lineWidth // distance from radius to edge of visible circle = half a line width
                                    // half a line width at each end = one line width in total
  }
}
