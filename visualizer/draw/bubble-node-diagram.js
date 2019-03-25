'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const BubbleNode = require('./bubble-node.js')
const ShadowCanvas = require('./util/shadowCanvas.js')

class BubbleNodeDiagram {
  constructor (bubbleNodeContainer) {
    this.bubbleNodeContainer = bubbleNodeContainer
    this.ui = bubbleNodeContainer.ui

    this.svgNodes = new Map()
    this.canvasCtx = null
    this.shadowCanvas = null

    this.ui.on('initializeFromData', () => {
      // Called once, creates group contents using d3's .append()
      this.initializeFromData()
    })

    this.ui.on('setData', () => {
      // Called any time the layout or ui object are changed
      this.setData()
    })

    this.ui.on('svgDraw', () => {
      this.shadowCanvas.clear()
      // Called any time the SVG DOM elements need to be modified or redrawn
      this.draw()
    })

    this.ui.on('selectNode', layoutNode => {
      this.svgNodes.get(layoutNode.id).select()
    })
  }

  initializeElements () {
    if (this.bubbleNodeContainer.renderType === 'svg') {
      this.d3Container = this.bubbleNodeContainer.d3Element
    }

    if (this.bubbleNodeContainer.renderType === 'canvas') {
      this.canvasCtx = this.bubbleNodeContainer.d3Element.node().getContext('2d')
      this.d3Container = d3.select(document.createElement('custom'))
    }
    if (this.canvasCtx) {
      this.shadowCanvas = new ShadowCanvas()
      // document.getElementById('node-link').append(this.shadowCanvas.canvasElement)
      // this.shadowCanvas.canvasElement.style = 'position:absolute; top:0; left: 0; opacity: 1'
    }
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
      if (!this.svgNodes.has(layoutNode.id)) this.svgNodes.set(layoutNode.id, new BubbleNode(this))
      this.svgNodes.get(layoutNode.id).setData(layoutNode)
    })

    if (this.shadowCanvas) {
      this.shadowCanvas.setDimensions(this.ui.layout.settings.svgWidth, this.ui.layout.settings.svgHeight)
    }
  }

  initializeFromData () {
    this.d3NodeGroups = this.d3Enter.append('g')
      .classed('node-group', true)
      .attr('name', layoutNode => layoutNode.id)
      .each((layoutNode, i, nodes) => {
        const d3NodeGroup = d3.select(nodes[i])
        this.svgNodes.get(layoutNode.id).initializeFromData(d3NodeGroup)
      })

    this.bubbleNodeContainer.d3Element
      .on('mousemove', () => {
        const layoutNode = this.shadowCanvas.getData(d3.event)
        if (layoutNode) {
          if (!this.ui.highlightedDataNode) {
            this.ui.highlightNode(layoutNode)
          }
        } else {
          this.ui.highlightNode(null)
        }
      })
      .on('click', () => {
        const layoutNode = this.shadowCanvas.getData(d3.event)
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

    this.bubbleNodeContainer.d3Element.classed('fade-elements-in', isExpanding)
    this.bubbleNodeContainer.d3Element.classed('fade-elements-out', !isExpanding)
    this.bubbleNodeContainer.d3Element.classed('complete-fade-out', false)
    this.bubbleNodeContainer.d3Element.classed('complete-fade-in', false)

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
    this.shadowCanvas.clear()

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

module.exports = BubbleNodeDiagram
