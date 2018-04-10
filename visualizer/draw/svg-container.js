'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')
const Bubbles = require('./svg-bubbles.js')
const Links = require('./svg-links.js')

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
        height: 1000, // This may be overridden by layout.scale
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
    this.links = new Links(this, contentProperties)
  }

  initializeElements () {
    super.initializeElements()

    if (this.svgBounds) {
      const {
        minX,
        minY,
        width,
        preserveAspectRatio
      } = this.svgBounds

      this.d3Element
        .attr('id', 'test ID')
        .attr('preserveAspectRatio', preserveAspectRatio)

      this.ui.on('setData', () => {
        const height = this.ui.layout.scale.finalSvgHeight || this.svgBounds.height
        this.d3Element.attr('viewBox', `${minX} ${minY} ${width} ${height}`)
      })
    }
  }

  draw () {
    this.ui.emit('svgDraw')
  }
}

module.exports = SvgContainer
