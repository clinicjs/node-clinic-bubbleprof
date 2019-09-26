'use strict'

const HtmlContent = require('./html-content.js')
const BubbleNodeDiagram = require('./bubble-node-diagram.js')

class BubbleNodeContainer extends HtmlContent {
  constructor (parentContent, contentProperties = {}) {
    const defaultProperties = {
      htmlElementType: 'svg'
    }
    super(parentContent, Object.assign(defaultProperties, contentProperties))

    // this.renderType =

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
    this.ui.nodeLinkContainer = this
    this.svgNodeDiagram = new BubbleNodeDiagram(this)
    this.ui.svgNodeDiagram = this.svgNodeDiagram

    this.ui.on('setData', () => {
      this.setData()
    })
  }

  get renderType () {
    return this.contentProperties.htmlElementType
  }

  setData () {
    const {
      minX,
      minY,
      preserveAspectRatio
    } = this.svgBounds
    this.svgBounds.height = this.ui.layout.scale.finalSvgHeight || this.ui.layout.settings.svgHeight
    this.svgBounds.width = this.ui.layout.settings.svgWidth

    if (this.renderType === 'svg') {
      this.d3Element
        .attr('viewBox', `${minX} ${minY} ${this.svgBounds.width} ${this.svgBounds.height}`)
        .attr('preserveAspectRatio', preserveAspectRatio)
    }

    if (this.renderType === 'canvas') {
      this.initializeCanvas()
    }
  }

  initializeCanvas () {
    this.d3Element
      .attr('width', this.svgBounds.width)
      .attr('height', this.svgBounds.height)
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

module.exports = BubbleNodeContainer
