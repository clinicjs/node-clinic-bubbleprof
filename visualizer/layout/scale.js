'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')
const { pickLeavesByLongest } = require('./stems.js')

class Scale {
  constructor (nodes, settings = {}) {
    const defaultSettings = {
      lineWidth: 2.5,
      labelMinimumSpace: 14
    }
    this.nodes = nodes
    this.settings = Object.assign(defaultSettings, settings)
  }
  calculateScaleFactor () {
    // Called after new Scale() because it reads stem length data based on logic
    // using the spacing/width settings and radiusFromCircumference()
    const leavesByShortest = pickLeavesByLongest(this.nodes, this).reverse()

    const longest = leavesByShortest[leavesByShortest.length - 1].stem.getTotalStemLength(this)
    const shortest = leavesByShortest[0].stem.getTotalStemLength(this)
    // TODO: Consider using in-between computed values for quantiles, like d3 does
    const q50 = leavesByShortest[Math.floor(leavesByShortest.length / 2)].stem.getTotalStemLength(this)
    const q25 = leavesByShortest[Math.floor(leavesByShortest.length / 4)].stem.getTotalStemLength(this)
    const q75 = leavesByShortest[Math.floor(3 * leavesByShortest.length / 4)].stem.getTotalStemLength(this)

    const availableWidth = (this.settings.svgWidth / 2) - (this.settings.svgDistanceFromEdge * 2)
    const stretchedHeight = this.settings.svgHeight * 1.5
    const availableHeight = (stretchedHeight) - (this.settings.svgDistanceFromEdge * 2)

    // Note - assumptions below depend on ClumpPyramid Positioning
    const scalesBySignificance = [
      // Longest should be no more (and ideally no less) than 1.5 height
      new ScaleWeight('longest', availableHeight, longest.scalable, longest.absolute),
      // Shortest should be no more (and ideally no less) than half width
      new ScaleWeight('shortest', availableWidth, shortest.scalable, shortest.absolute),
      // q50 is usually angled like the hypotenuse in a 1-1-sqrt(2) triangle, which indicates 1/sqrt(2)=~71% of line length in width is ideal
      new ScaleWeight('q50 1-1-sqrt(2) triangle', availableWidth, q50.scalable * 0.71, q50.absolute),
      // q25 is usually angled like the hypotenuse in a 4-3-5 triangle, which indicates 80% of line length in width is ideal
      new ScaleWeight('q25 4-3-5 triangle', availableWidth, q25.scalable * 0.8, q25.absolute),
      // q75 is usually angled like the hypotenuse in a 3-4-5 triangle, which indicates 60% of line length in width is ideal
      new ScaleWeight('q75 3-4-5 triangle', availableWidth, q75.scalable * 0.6, q75.absolute)
    ]
    const smallestSide = availableWidth < availableHeight ? availableWidth : availableHeight
    const largestDiameter = leavesByShortest.map((node) => node.stem.ownDiameter).sort((a, b) => b - a)[0]
    // For diagram clarity, largest circle should be no more (and ideally no less) than quater of the viewport
    const diameterClamp = new ScaleWeight('diameter clamp', smallestSide / 2, largestDiameter, 0)

    const accountedScales = scalesBySignificance.slice(0, leavesByShortest.length).concat([diameterClamp])
    const scalesBySmallest = accountedScales.sort((a, b) => a.weight - b.weight)

    this.decisiveWeight = scalesBySmallest[0]
    this.scaleFactor = this.decisiveWeight.weight

    this.finalSvgHeight = this.decisiveWeight.available > this.settings.svgHeight ? stretchedHeight : this.settings.svgHeight
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
  constructor (category, available, scalableToContain, absoluteToContain) {
    this.category = category
    this.available = available
    this.absoluteToContain = absoluteToContain
    this.scalableToContain = scalableToContain
    this.weight = (available - absoluteToContain) / scalableToContain
    if (this.weight < 0 && absoluteToContain > 0) {
      this.weight = available / absoluteToContain
    }
  }
}

module.exports = Scale
