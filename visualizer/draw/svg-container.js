'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')
const Bubbles = require('./svg-bubbles.js')

class SvgContainer extends HtmlContent {
  constructor (parentContent, contentProperties = {}) {
    const defaultProperties = {
      htmlElementType: 'svg'
    }
    super(parentContent, Object.assign(defaultProperties, contentProperties))

    if (contentProperties.svgBounds) {
      const defaultBounds = {
        minX: 0,
        minY: 0,
        width: 1000,
        height: 1000,
        preserveAspectRatio: 'xMidYMid meet',
        minimumDistanceFromEdge: 20
      }
      this.svgBounds = Object.assign(defaultBounds, contentProperties.svgBounds)
    }

    this.bubbles = null
    this.links = null
  }

  addBubbles (contentProperties) {
    this.bubbles = new Bubbles(this, contentProperties)
  }

  addLinks (contentProperties) {
    // TODO // this.links = new Links(this, contentProperties)
  }

  initializeElements () {
    super.initializeElements()

    console.log('init', this.svgBounds)

    if (this.svgBounds) {
      const {
        minX,
        minY,
        width,
        height,
        preserveAspectRatio
      } = this.svgBounds

      this.d3Element
        .attr('id', 'test ID')
        .attr('viewBox', `${minX} ${minY} ${width} ${height}`)
        .attr('preserveAspectRatio', preserveAspectRatio)
    }
  }

  draw () {
    this.ui.emit('svgDraw')
  }
}

module.exports = SvgContainer
