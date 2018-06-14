'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')
const SvgNodeDiagram = require('./svg-node-diagram.js')
/*
const Bubbles = require('./svg-bubbles.js')
const Links = require('./svg-links.js')
*/

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
        width: null, // Set from layout.settings
        height: null, // Set in layout.scale
        preserveAspectRatio: 'xMidYMid meet',
        minimumDistanceFromEdge: 20
      }
      this.svgBounds = Object.assign(defaultBounds, contentProperties.svgBounds)
    }
/*
    this.bubbles = null
    this.links = null
  }

  addBubbles (contentProperties) {
    this.bubbles = new Bubbles(this, contentProperties)
  }

  addLinks (contentProperties) {
    this.links = new Links(this, contentProperties)
  }
*/

    this.svgNodeDiagram = new SvgNodeDiagram(this)

    this.ui.on('setData', () => {
      this.setData()
    })
  }

  setData () {
    const {
      minX,
      minY,
      preserveAspectRatio
    } = this.svgBounds
    this.svgBounds.height = this.ui.layout.scale.finalSvgHeight || this.ui.layout.settings.svgHeight
    this.svgBounds.width = this.ui.layout.settings.svgWidth

    this.d3Element
      .attr('viewBox', `${minX} ${minY} ${this.svgBounds.width} ${this.svgBounds.height}`)
      .attr('preserveAspectRatio', preserveAspectRatio)
  }

  initializeElements () {
    super.initializeElements()

    this.d3Element
      .attr('id', this.contentProperties.id)
      .classed('bubbleprof', true)

    this.svgNodeDiagram.initializeElements()
  }

  draw () {
    this.svgNodeDiagram.draw()
//    this.ui.emit('svgDraw')
  }
}

module.exports = SvgContainer
