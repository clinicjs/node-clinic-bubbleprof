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

    this.ui.on('selectNode', layoutNode => {
      this.svgNodes.get(layoutNode.id).select()
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
      .on('mouseenter', layoutNode => this.ui.highlightNode(layoutNode))
      .on('mouseleave', () => this.ui.highlightNode(null))
      .on('click', (layoutNode) => {
        d3.event.stopPropagation()
        this.ui.queueAnimation('selectGraphNode', (animationQueue) => {
          this.ui.selectNode(layoutNode, animationQueue).then(targetUI => {
            if (targetUI !== this.ui) {
              this.ui.originalUI.emit('navigation', { from: this.ui, to: targetUI })
            }
            animationQueue.execute()
          })
        })
      })
  }

  animate (isExpanding, onComplete) {
    this.ui.isAnimating = true

    this.svgContainer.d3Element.classed('fade-elements-in', isExpanding)
    this.svgContainer.d3Element.classed('fade-elements-out', !isExpanding)
    this.svgContainer.d3Element.classed('complete-fade-out', false)
    this.svgContainer.d3Element.classed('complete-fade-in', false)

    const parentContainer = this.ui.parentUI.svgNodeDiagram.svgContainer
    parentContainer.d3Element.classed('fade-elements-in', false)
    parentContainer.d3Element.classed('fade-elements-out', false)
    parentContainer.d3Element.classed('complete-fade-out', isExpanding)
    parentContainer.d3Element.classed('complete-fade-in', !isExpanding)

    this.bbox = this.d3Container.node().getBoundingClientRect()

    const svgNodeAnimations = []
    this.svgNodes.forEach(svgNode => svgNode.animate(svgNodeAnimations, isExpanding))

    Promise.all(svgNodeAnimations).then(() => {
      this.ui.isAnimating = false
      if (onComplete) onComplete()
    })
  }

  deselectAll () {
    this.svgNodes.forEach(svgNode => svgNode.deselect())
  }

  draw () {
    if (this.ui.isAnimating) return

    this.bbox = this.d3Container.node().getBoundingClientRect()
    this.svgNodes.forEach(svgNode => svgNode.draw())
  }

  getVerticalLength (x, y, degrees) {
    return this.getLengthToSide(x, y, 90 - degrees, false)
  }

  getHorizontalLength (x, y, degrees) {
    return this.getLengthToSide(x, y, degrees, true)
  }

  getLengthToSide (x, y, degrees, horizontal = false) {
    // Outer padding is partly for labels to use, allow a little encrouchment especially on vertical
    const allowedEncrouchment = horizontal ? 3 : 6
    const coordinate = horizontal ? x : y
    const measurement = horizontal ? 'width' : 'height'

    const distanceFromEdge = this.ui.settings.svgDistanceFromEdge / allowedEncrouchment

    // Ensure degrees range is between -180 and 180
    degrees = LineCoordinates.enforceDegreesRange(degrees)
    let radians
    let adjacentLength

    if (degrees > 90 || degrees < -90) {
      // Test against left or top side edge
      radians = LineCoordinates.degreesToRadians(180 - degrees)
      adjacentLength = coordinate - distanceFromEdge
    } else {
      // Test against right or bottom side edge
      radians = LineCoordinates.degreesToRadians(degrees)
      adjacentLength = this.bbox[measurement] - distanceFromEdge - coordinate
    }
    const hypotenuseLength = adjacentLength / Math.cos(radians)
    return hypotenuseLength
  }
}

module.exports = SvgNodeDiagram
