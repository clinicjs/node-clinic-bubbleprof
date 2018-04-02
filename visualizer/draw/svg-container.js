'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class SvgContainer extends HtmlContent {
  constructor (d3Container, contentProperties = {}, svgBounds = null) {
    const defaultProperties = {
      htmlElementType: 'svg'
    }
    super(d3Container, Object.assign(defaultProperties, contentProperties))

    if (svgBounds) {
      const defaultBounds = {
        minX: 0,
        minY: 0,
        width: 1000,
        height: 1000,
        preserveAspectRatio: 'xMidYMid meet',
        minimumDistanceFromEdge: 20
      }
      this.svgBounds = Object.assign(defaultBounds, svgBounds)
    }
  }

  initializeElements () {
    super.initializeElements()

    if (this.svgBounds) {
      const {
        minX,
        minY,
        width,
        height,
        preserveAspectRatio
      } = this.svgBounds

      this.d3Element
        .attr('viewBox', `${minX} ${minY} ${width} ${height}`)
        .attr('preserveAspectRatio', preserveAspectRatio)
    }
  }
}

module.exports = SvgContainer
