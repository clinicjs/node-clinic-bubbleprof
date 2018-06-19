'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const SvgNode = require('./svg-node.js')

class SvgNodeDiagram {
  constructor (svgContainer) {
    this.svgContainer = svgContainer
    this.ui = svgContainer.ui

    this.svgNodes = new Map()

    this.ui.on('initializeFromData', () => {
      // Called once, creates group contents using d3's .append()
      this.initializeFromData()
    })

    this.ui.on('setData', () => {
      // Called any time the layout or ui object are changed
      this.setData()
    })

    this.ui.on('svgDraw', () => {
      // Called any time the SVG DOM elements need to be modified or redrawn
      this.draw()
    })
  }

  initializeElements () {
    this.d3Container = this.svgContainer.d3Element

    // Group to which one group for each node is appended
    this.d3Element = this.d3Container.append('g')
      .classed('node-links-wrapper', true)
  }

  setData () {
    this.dataArray = [...this.ui.layout.layoutNodes.values()]
    this.d3Enter = this.d3Element.selectAll('g.node-group')
      .data(this.dataArray)
      .enter()

    this.dataArray.forEach(layoutNode => {
      if (!this.svgNodes.has(layoutNode.id)) this.svgNodes.set(layoutNode.id, new SvgNode(this))
      this.svgNodes.get(layoutNode.id).setData(layoutNode)
    })
  }

  initializeFromData () {
    this.d3NodeGroups = this.d3Enter.append('g')
      .classed('node-group', true)
      .attr('name', layoutNode => layoutNode.id)
      .each((layoutNode, i, nodes) => {
        const d3NodeGroup = d3.select(nodes[i])
        this.svgNodes.get(layoutNode.id).initializeFromData(d3NodeGroup)
      })
      .on('mouseover', layoutNode => this.ui.highlightNode(layoutNode))
      .on('mouseout', () => this.ui.highlightNode(null))
      .on('click', (layoutNode) => {
        d3.event.stopPropagation()
        const targetUI = this.ui.selectNode(layoutNode)
        if (targetUI !== this.ui) {
          this.ui.originalUI.emit('navigation', { from: this.ui, to: targetUI })
        }
      })
  }
  draw () {
    this.bbox = this.d3Container.node().getBoundingClientRect()
    this.svgNodes.forEach(svgNode => svgNode.draw())
  }

  getLengthToBottom (x1, y1, degrees) {
    // Outer padding is partly for labels to use, allow encrouchment most of the way
    const distanceFromEdge = this.ui.settings.svgDistanceFromEdge / 4

    const radians = LineCoordinates.degreesToRadians(90 - degrees)
    const adjacentLength = this.bbox.height - distanceFromEdge - y1
    const hypotenuseLength = adjacentLength / Math.cos(radians)
    return hypotenuseLength
  }

  getLengthToSide (x1, y1, degrees) {
    // Outer padding is partly for labels to use, allow a little encrouchment
    const distanceFromEdge = this.ui.settings.svgDistanceFromEdge

    // Ensure degrees range is between -180 and 180
    degrees = LineCoordinates.enforceDegreesRange(degrees)
    let radians
    let adjacentLength

    if (degrees > 90 || degrees < -90) {
      // Test against left side edge
      radians = LineCoordinates.degreesToRadians(180 - degrees)
      adjacentLength = x1 - distanceFromEdge
    } else {
      // Test against right side edge
      radians = LineCoordinates.degreesToRadians(degrees)
      adjacentLength = this.bbox.width - distanceFromEdge - x1
    }
    const hypotenuseLength = adjacentLength / Math.cos(radians)
    return hypotenuseLength
  }
}

module.exports = SvgNodeDiagram
