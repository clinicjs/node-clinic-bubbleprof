'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')
const { pickLeavesByLongest } = require('./stems.js')
const { validateNumber } = require('../validation.js')

class Scale {
  constructor (layout) {
    this.layout = layout
    this.layoutNodes = null // set later
  }
  calculateScaleFactor () {
    this.layoutNodes = this.layout.layoutNodes
    // Called after new Scale() because it reads stem length data based on logic
    // using the spacing/width settings and radiusFromCircumference()
    const leavesByShortest = pickLeavesByLongest(this.layoutNodes, this).reverse()

    const longest = leavesByShortest[leavesByShortest.length - 1].stem.getTotalStemLength(this)
    const shortest = leavesByShortest[0].stem.getTotalStemLength(this)
    // TODO: Consider using in-between computed values for quantiles, like d3 does
    const q50 = leavesByShortest[Math.floor(leavesByShortest.length / 2)].stem.getTotalStemLength(this)
    const q25 = leavesByShortest[Math.floor(leavesByShortest.length / 4)].stem.getTotalStemLength(this)
    const q75 = leavesByShortest[Math.floor(3 * leavesByShortest.length / 4)].stem.getTotalStemLength(this)

    const nodesCount = this.layoutNodes.size

    const {
      svgWidth,
      svgDistanceFromEdge,
      allowStretch
    } = this.layout.settings

    // Reduces scrolling on tiny sublayouts. Only needed on scroll view mode
    const svgHeightAdjustment = nodesCount < 4 && allowStretch ? 0.2 * (nodesCount + 1) : 1
    const svgHeight = this.layout.settings.svgHeight * svgHeightAdjustment

    const availableHeight = svgHeight - (svgDistanceFromEdge * 2)
    const availableWidth = (svgWidth / 2) - svgDistanceFromEdge

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
      new ScaleWeight('q50 1-1-sqrt(2) triangle', leavesByShortest[Math.floor(leavesByShortest.length / 2)], availableWidth, q50.scalable * 0.71, q50.absolute),
      // q25 is usually angled like the hypotenuse in a 4-3-5 triangle, which indicates 80% of line length in width is ideal
      new ScaleWeight('q25 4-3-5 triangle', leavesByShortest[Math.floor(leavesByShortest.length / 4)], availableWidth, q25.scalable * 0.8, q25.absolute),
      // q75 is usually angled like the hypotenuse in a 3-4-5 triangle, which indicates 60% of line length in width is ideal
      new ScaleWeight('q75 3-4-5 triangle', leavesByShortest[Math.floor(3 * leavesByShortest.length / 4)], availableWidth, q75.scalable * 0.6, q75.absolute)
    ]
    const smallestSide = availableWidth < availableHeight ? availableWidth : availableHeight
    const largestDiameterNode = [...this.layoutNodes.values()].sort((a, b) => b.stem.ownDiameter - a.stem.ownDiameter)[0]
    // For diagram clarity, largest circle should be no more (and ideally no less) than quater of the viewport
    const diameterClamp = new ScaleWeight('diameter clamp', largestDiameterNode, smallestSide / 2, largestDiameterNode.stem.ownDiameter, 0)
    const longestConstrained = new ScaleWeight('longest constrained', leavesByShortest[leavesByShortest.length - 1], availableHeight, longest.scalable, longest.absolute)

    const accountedScales = [longestConstrained, ...scalesBySignificance.slice(0, leavesByShortest.length), diameterClamp]
    this.scalesBySmallest = accountedScales.sort((a, b) => a.weight - b.weight)

    this.decisiveWeight = this.scalesBySmallest[0]
    if (this.scalesBySmallest[0] === longestConstrained && this.scalesBySmallest[1] === longestStretched) {
      this.decisiveWeight = longestStretched
    }
    this.scaleFactor = validateNumber(this.decisiveWeight.weight)

    // For collapsing nodes, we need a threshold that is independent of the SVG size so that
    // the same data gives the same number of visible nodes if presented in different sized SVG
    // 680 is based on common window sizes and tested to give reasonable collapsing
    const sizeIndependentWeight = new ScaleWeight('size-independent', null, 680, longestStretched.scalableToContain, longestStretched.absoluteToContain)
    this.sizeIndependentScale = sizeIndependentWeight.weight

    const isLineTooLong = this.decisiveWeight === longestStretched
    const isDiameterAboveHeight = this.decisiveWeight === diameterClamp && smallestSide === availableHeight
    const shouldStretchHeight = isLineTooLong || isDiameterAboveHeight
    this.finalSvgHeight = shouldStretchHeight ? stretchedHeight : svgHeight
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
    this.available = available
    this.absoluteToContain = absoluteToContain
    this.scalableToContain = scalableToContain
    this.weight = (available - absoluteToContain) / scalableToContain
    if (this.weight < 0 && absoluteToContain > 0) {
      this.weight = available / absoluteToContain
    }
    // If there's only one node and it has zero size, weight will be Infinity
    // Default to 1 because there's nothing to scale
    if (!Number.isFinite(this.weight)) this.weight = 1
  }
}

module.exports = Scale
