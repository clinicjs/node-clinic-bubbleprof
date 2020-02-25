'use strict'

class Connection {
  constructor (originLayoutNode, targetLayoutNode, scale) {
    this.originId = originLayoutNode.id
    this.originLayoutNode = originLayoutNode
    this.originNode = originLayoutNode.node.shortcutTo || originLayoutNode.node

    this.targetId = targetLayoutNode.id
    this.targetLayoutNode = targetLayoutNode
    this.targetNode = targetLayoutNode.node.shortcutTo || targetLayoutNode.node

    this.scale = scale
  }

  // Avoid duplication of values so stats can be swtiched/recalculated with settings
  // If recalculating these proves to be a performance problem, consider caching values
  getOriginRadius () { return this.scale.getCircleRadius(this.originLayoutNode.getWithinTime()) }
  getTargetRadius () { return this.scale.getCircleRadius(this.targetLayoutNode.getWithinTime()) }
  getVisibleLineLength () { return this.scale.getLineLength(this.targetLayoutNode.getBetweenTime()) }
  getDistanceBetweenCenters () {
    return this.getOriginRadius() +
      this.getVisibleLineLength() +
      this.getTargetRadius() +
      // Leave a gap at both ends so any text labels are readable
      // Only one lineWidth because it increases distance by half a line width at each end
      this.scale.settings.labelMinimumSpace * 2 + this.scale.settings.lineWidth
  }
}

module.exports = Connection
