'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')
const { Bubbles, Links } = require('./svg-content.js')

class SvgContainer extends HtmlContent {
  constructor (parentContent, contentProperties = {}, svgBounds = null) {
    const defaultProperties = {
      htmlElementType: 'svg'
    }
    super(parentContent, Object.assign(defaultProperties, contentProperties))

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

    this.bubbles = null
    this.links = null
  }

  addBubbles (contentProperties) {
    this.bubbles = new Bubbles(this, contentProperties)
  }

  addLinks (contentProperties) {
    this.links = new Links(this, contentProperties)
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

  draw () {
    this.ui.emit('svgDraw')
  }
}

module.exports = SvgContainer
