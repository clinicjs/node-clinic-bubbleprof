'use strict'

const { radiusFromCircumference } = require('./line-coordinates.js')

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
    return radiusFromCircumference(equivalentLineLength)
  }
}

module.exports = Scale
