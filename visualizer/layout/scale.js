'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')
const { pickLeavesByLongest } = require('./stems.js')
const { validateNumber } = require('../validation.js')

class Scale {
  constructor (layout) {
    this.layout = layout
    this.layoutNodes = null // set later
    this.heightMultiplier = 1 // applied to calculations here, and to threshold in collapse-layout.js
  }

  // This simplified computation is necessary to ensure correct leaves order
  // when calculating the final scale factor
  calculatePreScaleFactor (collapsed = false) {
    this.layoutNodes = this.layout.layoutNodes
    const scaleByHeight = this.getScaleHeight(collapsed)

    // Setting used in tests and for (legacy) scrollable fixed height layouts
    const isStretchMode = this.layout.settings.allowStretch

    // Calculate the total fixed (absolute) pixel length gaps in the longest stem. For example, if a view initially
    // contains 1000 nodes and each node has a fixed gap of 10px, that's 10,000px we need to account for
    const toLongestAbsolute = (longest, layoutNode) => Math.max(longest, layoutNode.stem.lengths.absolute)
    const longestAbsolute = isStretchMode ? 0 : [...this.layoutNodes.values()].reduce(toLongestAbsolute, 0)

    // Extend the effective heights, lengths and thresholds used in calculations by that amount
    this.heightMultiplier = 1 + (longestAbsolute / scaleByHeight)
    const toLongest = (longest, layoutNode) => Math.max(longest, layoutNode.stem.lengths.scalable)
    const longest = [...this.layoutNodes.values()].reduce(toLongest, 0) + longestAbsolute

    this.prescaleFactor = scaleByHeight * (isStretchMode ? 1 : this.heightMultiplier) / (longest || 1)
  }

  calculateScaleFactor (collapsed = false) {
    // No need to apply the height multiplier after it increased the collapse threshold, squashing excessive nodes
    const multiplier = collapsed ? 1 : this.heightMultiplier
    const scaleByHeight = this.getScaleHeight(collapsed) * multiplier

    // Called after new Scale() because it reads stem length data based on logic
    // using the spacing/width settings and radiusFromCircumference()
    let leavesByShortest = pickLeavesByLongest(this.layoutNodes, this).reverse()
    // Zero-sized nodes do not affect the shape and therefore should not be accounted
    leavesByShortest = leavesByShortest.filter(leaf => leaf.stem.lengths.scalable > 0)

    const longest = leavesByShortest.length && leavesByShortest[leavesByShortest.length - 1].stem.lengths
    const shortest = leavesByShortest.length && leavesByShortest[0].stem.lengths
    // TODO: Consider using in-between computed values for quantiles, like d3 does
    const q50 = leavesByShortest.length && leavesByShortest[Math.floor(leavesByShortest.length / 2)].stem.lengths
    const q25 = leavesByShortest.length && leavesByShortest[Math.floor(leavesByShortest.length / 4)].stem.lengths
    const q75 = leavesByShortest.length && leavesByShortest[Math.floor(3 * leavesByShortest.length / 4)].stem.lengths

    const nodesCount = this.layoutNodes.size

    const {
      svgWidth,
      svgDistanceFromEdge,
      allowStretch
    } = this.layout.settings

    // Reduces scrolling on tiny sublayouts. Only needed on scroll view mode
    const svgHeightAdjustment = nodesCount < 4 && allowStretch ? 0.2 * (nodesCount + 1) : 1
    const svgHeight = scaleByHeight * svgHeightAdjustment

    const availableHeight = svgHeight - (svgDistanceFromEdge * 2)
    const availableWidth = (svgWidth / 2) - svgDistanceFromEdge
    const availableShortest = Math.min(availableWidth, svgHeight * 0.71 - svgDistanceFromEdge)

    // Only stretch if we're in scroll mode and it's a complex profile with many nodes that needs more space
    const stretchedHeight = svgHeight * (nodesCount > 6 && allowStretch ? 1.5 : 1)
    const availableStretchedHeight = stretchedHeight - (svgDistanceFromEdge * 2)

    const longestStretched = new ScaleWeight('longest', leavesByShortest[leavesByShortest.length - 1], availableStretchedHeight, longest.scalable, longest.absolute)
    // Note - assumptions below depend on ClumpPyramid Positioning
    const scalesBySignificance = [
      // Longest should be no more (and ideally no less) than 1.5 height
      longestStretched,
      // Shortest should be no more (and ideally no less) than half width
      new ScaleWeight('shortest', leavesByShortest[0], availableWidth, shortest.scalable, shortest.absolute),
      // q50 is usually angled like the hypotenuse in a 1-1-sqrt(2) triangle, which indicates 1/sqrt(2)=~71% of line length in width is ideal
      new ScaleWeight('q50 1-1-sqrt(2) triangle', leavesByShortest[Math.floor(leavesByShortest.length / 2)], availableShortest, q50.scalable * 0.71, q50.absolute),
      // q25 is usually angled like the hypotenuse in a 4-3-5 triangle, which indicates 80% of line length in width is ideal
      new ScaleWeight('q25 4-3-5 triangle', leavesByShortest[Math.floor(leavesByShortest.length / 4)], availableWidth, q25.scalable * 0.8, q25.absolute),
      // q75 is usually angled like the hypotenuse in a 3-4-5 triangle, which indicates 60% of line length in width is ideal
      new ScaleWeight('q75 3-4-5 triangle', leavesByShortest[Math.floor(3 * leavesByShortest.length / 4)], availableWidth, q75.scalable * 0.6, q75.absolute)
    ]
    const smallestSide = availableWidth < availableHeight ? availableWidth : availableHeight
    const largestDiameterNode = [...this.layoutNodes.values()].sort((a, b) => b.stem.raw.ownDiameter - a.stem.raw.ownDiameter)[0]
    // For diagram clarity, largest circle should be no more (and ideally no less) than quater of the viewport
    const diameterClamp = new ScaleWeight('diameter clamp', largestDiameterNode, smallestSide / 2, largestDiameterNode.stem.raw.ownDiameter, 0)
    const longestConstrained = new ScaleWeight('longest constrained', leavesByShortest[leavesByShortest.length - 1], availableHeight, longest.scalable, longest.absolute)

    const accountedScales = [longestConstrained, ...scalesBySignificance.slice(0, leavesByShortest.length), diameterClamp]
    if (leavesByShortest.length) {
      this.scalesBySmallest = accountedScales.sort((a, b) => a.weight - b.weight)
      this.decisiveWeight = this.scalesBySmallest[0]
      if (this.scalesBySmallest[0] === longestConstrained && this.scalesBySmallest[1] === longestStretched) {
        this.decisiveWeight = longestStretched
      }
    } else {
      this.decisiveWeight = new ScaleWeight('zero-sized view', null, availableShortest, 0, 0, 0)
      this.scalesBySmallest = [this.decisiveWeight]
    }
    this.scaleFactor = validateNumber(this.decisiveWeight.weight)

    const sizeIndependentHeight = this.layout.settings.sizeIndependentHeight * multiplier
    const sizeIndependentWeight = new ScaleWeight('size-independent', null, sizeIndependentHeight, longestStretched.scalableToContain, longestStretched.absoluteToContain)
    this.sizeIndependentScale = sizeIndependentWeight.weight

    const isLineTooLong = this.decisiveWeight === longestStretched
    const isDiameterAboveHeight = this.decisiveWeight === diameterClamp && smallestSide === availableHeight
    const shouldStretchHeight = isLineTooLong || isDiameterAboveHeight
    this.finalSvgHeight = shouldStretchHeight ? stretchedHeight : svgHeight
  }

  adjustScaleFactor (collapsed) {
    if (!this.isCollapsePending(collapsed) && !this.layout.settings.allowStretch) {
      const longest = pickLeavesByLongest(this.layoutNodes)[0].stem.lengths
      const {
        svgHeight,
        svgDistanceFromEdge
      } = this.layout.settings
      // In some rare cases, there is a long chain of nodes just above the collapse threshold whose absolute values break the scale
      if (longest.scaledTotal > svgHeight) {
        const heightAvailable = svgHeight - (svgDistanceFromEdge * 2) - longest.absolute

        if (heightAvailable <= 0) {
          const times = []
          this.layoutNodes.forEach(layoutNode => times.push(layoutNode.getTotalTime()))
          times.sort((a, b) => b - a)
          const maxTime = times[0]
          const len = times.length
          const medianTime = len % 2 && len > 1 ? (times[Math.floor(len / 2)] + times[Math.ceil(len / 2)]) / 2 : times[Math.floor(len / 2)]

          // Let the largest item be up to 3px so it stands out; smaller if it's less than three times the median.
          // This ensures that most items have tiny <1px width, to minimise overflow, but the largest ones still stand out, so the view is usable.
          this.scaleFactor = Math.min(3, maxTime / medianTime) / maxTime
          return true
        }

        // Store the modifier while applying it so it can be seen and inspected in debugging
        this.decisiveWeight.modifier = heightAvailable / (longest.scaledTotal - longest.absolute)
        this.scaleFactor = this.scaleFactor * this.decisiveWeight.modifier
        return true
      }
    }
    return false
  }

  isCollapsePending (collapsed) {
    return !collapsed && this.layout.settings.collapseNodes
  }

  getScaleHeight (collapsed) {
    return !this.isCollapsePending(collapsed) ? this.layout.settings.svgHeight : this.layout.settings.sizeIndependentHeight
  }

  getLineLength (dataValue) {
    return dataValue * this.scaleFactor
  }

  getCircleRadius (dataValue) {
    const equivalentLineLength = this.getLineLength(dataValue)
    return radiusFromCircumference(equivalentLineLength)
  }
}

class ScaleWeight {
  constructor (category, node, available, scalableToContain, absoluteToContain) {
    this.category = category
    this.node = node
    this.modifier = false // this is set if this scale is used but a multiplication adjustment is needed

    this.available = available
    this.absoluteToContain = absoluteToContain
    this.scalableToContain = scalableToContain
    this.weight = (available - absoluteToContain) / scalableToContain
    if (this.weight < 0 && absoluteToContain > 0) {
      this.weight = available / absoluteToContain
    }
    // If node has zero size, weight will be Infinity
    // Default to stretching to available (or absolute if it's more than available)
    if (!Number.isFinite(this.weight)) this.weight = available > absoluteToContain ? available - absoluteToContain : absoluteToContain
  }
}

module.exports = Scale
