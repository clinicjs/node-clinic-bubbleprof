'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const svgNodeElementTypes = require('./svg-node-element.js')

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
  }

  initializeFromData () {
    this.d3NodeGroups = this.d3Enter.append('g')
      .classed('node-group', true)
      .each((layoutNode, i, nodes) => {
        const d3NodeGroup = d3.select(nodes[i])

        const svgNode = new SvgNode(this)
          .setData(layoutNode)
          .initializeElements(d3NodeGroup)

        this.svgNodes.set(layoutNode.id, svgNode)
    })
  }
  draw () {
    this.svgNodes.forEach(svgNode => svgNode.draw())
  }
}

class SvgNode {
  constructor (parentContent) {
    this.parentContent = parentContent
    this.ui = parentContent.ui

    // Set and updated in .setCoordinates():
    this.strokePadding = null
    this.degrees = null
    this.originPoint = null

    this.asyncBetweenLines = new SvgNodeSection(this, {
      dataPosition: 'asyncBetween',
      shapeClass: 'SvgLine'
    })
    this.asyncWithinLines = new SvgNodeSection(this, {
      dataPosition: 'asyncWithin',
      shapeClass: 'SvgSpiral'
    })
    this.syncBubbles = new SvgNodeSection(this, {
      dataPosition: 'asyncWithin',
      shapeClass: 'SvgBubble'
    })
  }

  setData (layoutNode) {
    this.layoutNode = layoutNode
    this.drawType = this.getDrawType(layoutNode)

    this.asyncBetweenLines.setData(layoutNode)
    if (this.drawType !== 'squash') {
      this.asyncWithinLines.setData(layoutNode)
      this.syncBubbles.setData(layoutNode)
    }

    this.setCoordinates()
    return this
  }

  setCoordinates () {
    this.strokePadding = this.ui.settings.strokePadding
    this.labelMinimumSpace = this.ui.layout.settings.labelMinimumSpace

    const inboundConnection = this.layoutNode.inboundConnection
    const previousPosition = inboundConnection ? inboundConnection.sourceLayoutNode.position : {
      x: this.layoutNode.position.x,
      y: this.strokePadding + this.labelMinimumSpace
    }
    const connectCentresCoords = new LineCoordinates({
      x1: previousPosition.x,
      y1: previousPosition.y,
      x2: this.layoutNode.position.x,
      y2: this.layoutNode.position.y
    })

    this.degrees = connectCentresCoords.degrees

    // TODO: check that this doesn't look wrong in cases of drawType = squash but has withinTime
    const sourceRadius = inboundConnection ? this.getRadius(inboundConnection.sourceLayoutNode) + this.strokePadding : 0

    const offsetLength = sourceRadius + this.ui.settings.lineWidth / 2 + this.labelMinimumSpace
    const offsetBeforeLine = new LineCoordinates({
        radians: connectCentresCoords.radians,
        length: offsetLength,
        x1: previousPosition.x,
        y1: previousPosition.y
      })

    this.originPoint = {
      x: offsetBeforeLine.x2,
      y: offsetBeforeLine.y2
    }
  }

  initializeElements (d3NodeGroup) {
    this.d3NodeGroup = d3NodeGroup

    this.d3OuterPath = this.d3NodeGroup.append('path')
      .classed('outer-path', true)

    this.d3NameLabel = this.d3NodeGroup.append('text')
      .classed('text-label', true)
      .classed('name-label', true)

    this.d3AsyncTimeLabel = this.d3NodeGroup.append('text')
      .classed('time-label', true)
      .classed('name-label', true)

    this.d3SyncTimeLabel = this.d3NodeGroup.append('text')
      .classed('time-label', true)
      .classed('name-label', true)

    return this
  }

  draw () {
    this.d3OuterPath.attr('d', this.getOuterPathDef())
  }

  getOuterPathDef () {
    let outerPath = ''

    const toLineTopLeft = new LineCoordinates({
      x1: this.originPoint.x,
      y1: this.originPoint.y,
      length: this.strokePadding,
      degrees: this.degrees - 90
    })
    outerPath += `M ${toLineTopLeft.x2} ${toLineTopLeft.y2} `

    const toLineTopRight = new LineCoordinates({
      x1: toLineTopLeft.x2,
      y1: toLineTopLeft.y2,
      length: this.strokePadding * 2,
      degrees: this.degrees + 90
    })
    const toQCurveControlPoint = new LineCoordinates({
      x1: this.originPoint.x,
      y1: this.originPoint.y,
      length: this.strokePadding,
      degrees: this.degrees - 180
    })
    outerPath += `Q ${toQCurveControlPoint.x2} ${toQCurveControlPoint.y2} ${toLineTopRight.x2} ${toLineTopRight.y2}`
//    outerPath += `L ${toLineTopRight.x2} ${toLineTopRight.y2} `

//    const lengthStat = this.drawType === 'squash' ? this.layoutNode.getBetweenTime() : this.layoutNode.getTotalTime()
    const lineLength = this.getLength()

    const toLineBottomRight = new LineCoordinates({
      x1: toLineTopRight.x2,
      y1: toLineTopRight.y2,
      length: lineLength,
      degrees: this.degrees
    })

    console.log('toLineBottomRight', toLineBottomRight, Object.assign({}, toLineBottomRight))
    outerPath += `L ${toLineBottomRight.x2} ${toLineBottomRight.y2} `

    if (this.drawType === 'squash') {
      // End with pointed arrow tip

      const toPointedTip = new LineCoordinates({
        x1: this.originPoint.x,
        y1: this.originPoint.y,
        length: lineLength + this.strokePadding,
        degrees: this.degrees
      })
      console.log('toPointedTip', toPointedTip, Object.assign({}, toPointedTip))

      outerPath += `L ${toPointedTip.x2} ${toPointedTip.y2} `

      outerPath += 'L' // Ready for simple line to bottom left x y
    } else {
      // End with long-route circular arc around bubble, to bottom left x y

      const arcRadius = this.getRadius() + this.strokePadding
      // Arc definition: A radiusX radiusY x-axis-rotation large-arc-flag sweep-flag x y
      outerPath += `A ${arcRadius} ${arcRadius} 0 1 0`
    }

    const toLineBottomLeft = new LineCoordinates({
      x1: toLineBottomRight.x2,
      y1: toLineBottomRight.y2,
      length: this.strokePadding * 2,
      degrees: this.degrees - 90
    })

    outerPath += ` ${toLineBottomLeft.x2} ${toLineBottomLeft.y2} Z`

    return outerPath
  }

  getRadius (layoutNode = this.layoutNode) {
    return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
  }

  getLength (layoutNode = this.layoutNode) {
    if (this.drawType === 'squash') {
      return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime() + layoutNode.getWithinTime())
    } else {
      return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime())
    }
  }

  getDrawType (layoutNode) {
    const circleRadius = this.getRadius()
    const lineLength = this.getLength()

    if (circleRadius + lineLength < 2) {
      return 'squash' // too small to discriminate node elements; show a very short line
    }
  }
}

class SvgNodeSection {
  constructor (parentContent, settings) {
    this.parentContent = parentContent

    const {
      dataPosition,
      shape
    } = settings
    this.dataPosition = dataPosition
    this.shape = shape

    this.d3NodeGroups = this.parentContent.d3NodeGroups
  }
  setData (dataArray) {
    this.dataArray = dataArray
  }
  initializeFromData () {
    const SvgNodeElement = svgNodeElementTypes[this.settings.shapeClass]

    this.d3Groups = this.d3Enter.append('g')
      .each((layoutNode, i, nodes) => {
        const d3Group = d3.select(nodes[i])

        for (const layoutNode of this.dataArray) {
          // For ctrl+f: calls new SvgLine(), new SvgSpiral() or new SvgCircle()
          const shapeByParty = new SvgNodeElement(this, d3Group, 'party')
            .setData(layoutNode)
            .initializeFromData()
          this.byParty.set(layoutNode.id, shapeByParty)

          const shapeByType = new SvgNodeElement(this, d3Group, 'typeCategory')
            .setData(layoutNode)
            .initializeFromData()
          this.byCategory.set(layoutNode.id, shapeByType)
        }
      })

  }
  draw () {


  }
}

module.exports = SvgNodeDiagram
