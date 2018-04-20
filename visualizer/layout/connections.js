'use strict'

class Connection {
  constructor (sourceLayoutNode, targetLayoutNode, scale) {
    // TODO: rename sourceNode everywhere to avoid confusion with DataNode->SourceNode class
    this.sourceId = sourceLayoutNode.id
    this.sourceLayoutNode = sourceLayoutNode
    this.sourceNode = sourceLayoutNode.node

    this.targetId = targetLayoutNode.id
    this.targetLayoutNode = targetLayoutNode
    this.targetNode = targetLayoutNode.node

    this.scale = scale

    // TODO: remove this completely once all branches are merged and released
    // this.targetNode.connectionFromParent = this
  }

  // Avoid duplication of values so stats can be swtiched/recalculated with settings
  // If recalculating these proves to be a performance problem, consider caching values
  getSourceRadius () { return this.scale.getCircleRadius(this.sourceLayoutNode.getWithinTime()) }
  getTargetRadius () { return this.scale.getCircleRadius(this.targetLayoutNode.getWithinTime()) }
  getVisibleLineLength () { return this.scale.getLineLength(this.targetLayoutNode.getBetweenTime()) }
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
