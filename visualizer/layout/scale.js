'use strict'

class Scale {
  constructor (dataSet, settings = {}) {
    const defaultSettings = {
      lineWidth: 2.5,
      labelMinimumSpace: 14
    }
    this.dataSet = dataSet
    this.settings = Object.assign(defaultSettings, settings)
  }

  setScaleFactor () {
    // Called after new Scale() because it reads stem length data based on logic
    // using the spacing/width settings and radiusFromCircumference()

    this.scaleFactor = 1 // To be replaced with autoscaling logic based on stem length data.
  }

  getLineLength (dataValue) {
    return dataValue * this.scaleFactor
  }

  getCircleRadius (dataValue) {
    const equivalentLineLength = this.getLineLength(dataValue)
    return Scale.radiusFromCircumference(equivalentLineLength)
  }

  static radiusFromCircumference (circumference) {
    // Each pixel of colour must represent the same amount of time, else
    // the dataviz is misleading. So, circles representing delays within a
    // node are stroked, not filled, and data is linked to circumference,
    // not area, so lines and circles are equivalent
    return circumference / (2 * Math.PI)
  }
}

module.exports = Scale
