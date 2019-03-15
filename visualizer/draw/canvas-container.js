'use strict'

const HtmlContent = require('./html-content.js')
const CanvasNodeDiagram = require('./canvas-node-diagram.js')

class CanvasContainer extends HtmlContent {
  constructor (parentContent, contentProperties = {}) {
    const defaultProperties = {
      htmlElementType: 'canvas'
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

    this.canvasNodeDiagram = new CanvasNodeDiagram(this)
    // this.ui.svgNodeDiagram = this.canvasNodeDiagram

    this.ui.on('setData', () => {
      this.setData()
    })
  }

  setData () {
    this.d3Element
      .attr('height', this.ui.layout.scale.finalSvgHeight || this.ui.layout.settings.svgHeight)
      .attr('width', this.ui.layout.settings.svgWidth)
  }

  initializeElements () {
    super.initializeElements()

    this.canvasContext = this.d3Element.node().getContext('2d')

    this.d3Element
      .attr('id', this.contentProperties.id)
      .classed('bubbleprof', true)

    this.canvasNodeDiagram.initializeElements()
  }

  animate (previousUI) {
    // this.canvasNodeDiagram.animate(previousUI)
  }

  draw () {
    this.canvasNodeDiagram.draw()
  }
}

module.exports = CanvasContainer
