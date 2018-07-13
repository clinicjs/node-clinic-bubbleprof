'use strict'

const HtmlContent = require('./html-content.js')
const SvgNodeDiagram = require('./svg-node-diagram.js')

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

    this.svgNodeDiagram = new SvgNodeDiagram(this)
    this.ui.svgNodeDiagram = this.svgNodeDiagram

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

  animate (previousUI) {
    this.svgNodeDiagram.animate(previousUI)
  }

  draw () {
    this.svgNodeDiagram.draw()
  }
}

module.exports = SvgContainer
