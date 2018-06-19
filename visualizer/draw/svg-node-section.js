'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')

class SvgNodeSection {
  constructor (parentContent, settings) {
    this.parentContent = parentContent
    this.ui = parentContent.ui

    const {
      dataPosition,
      shapeClass
    } = settings
    this.dataPosition = dataPosition
    this.shapeClass = shapeClass
  }
  setData (layoutNode) {
    this.layoutNode = layoutNode
  }
  initializeFromData () {
    this.d3NodeGroup = this.parentContent.d3NodeGroup

    if (this.shapeClass === 'SvgBubble') {
      this.d3InnerCircle = this.d3NodeGroup.append('circle')
        .classed('inner-circle', true)
    }

    const svgNodeElementClasses = {
      SvgLine,
      SvgBubble,
      SvgSpiral
    }

    const SvgNodeElementClass = svgNodeElementClasses[this.shapeClass]

    this.byParty = new SvgNodeElementClass(this, this.d3NodeGroup, 'party')
      .setData(this.layoutNode)
      .initializeFromData()

    this.byType = new SvgNodeElementClass(this, this.d3NodeGroup, 'typeCategory')
      .setData(this.layoutNode)
      .initializeFromData()
  }
  draw () {
    // In case this was too small to show on page load, but screen has been resized up, and now it's big enough
    if (!this.byParty) this.initializeFromData()

    this.byParty.draw()
    this.byType.draw()

    if (this.d3InnerCircle) {
      this.d3InnerCircle
        .attr('cx', this.parentContent.circleCentre.x)
        .attr('cy', this.parentContent.circleCentre.y)
        .attr('r', Math.max(this.parentContent.getRadius() - this.ui.settings.lineWidth * 4, 0))
    }
  }
}

class SvgNodeElement {
  constructor (parentContent, d3Group, dataType) {
    this.svgNode = parentContent.parentContent
    this.d3Group = d3Group
    this.ui = parentContent.ui

    this.dataPosition = parentContent.dataPosition
    this.dataType = dataType
  }
  setData (layoutNode) {
    this.decimalsArray = layoutNode.node.getDecimalsArray(this.dataType, this.dataPosition)

    return this
  }

  getRadius (layoutNode) {
    return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
  }

  getLength (layoutNode) {
    return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime())
  }
}

class SvgLine extends SvgNodeElement {
  initializeFromData () {
    const d3Enter = this.d3Group.selectAll('line.segmented-line')
      .data(this.decimalsArray)
      .enter()

    const classPrepend = this.dataType === 'typeCategory' ? 'type' : 'party'
    const highlightEvent = this.dataType === 'typeCategory' ? 'highlightType' : 'highlightParty'

    this.d3Shapes = d3Enter.append('line')
      .attr('class', decimal => `line-segment ${classPrepend}-${decimal[0]}`)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', decimal => this.ui.emit(highlightEvent, decimal[0]))
      .on('mouseout', () => this.ui.emit(highlightEvent, null))

    return this
  }
  setCoordinates () {
    this.degrees = this.svgNode.degrees
    this.length = this.svgNode.drawType === 'squash' ? Math.max(this.svgNode.getLength(), 1) : this.svgNode.getLength()

    let degrees
    let length
    if (this.svgNode.drawType === 'labelOnLine') {
      degrees = this.degrees + 90 * (this.svgNode.flipLabel ? -1 : 1)
      length = this.ui.settings.lineWidth * (this.dataType === 'typeCategory' ? 4 : 2)
    } else {
      const onLeftSide = (this.svgNode.flipLabel && this.dataType === 'typeCategory') || (!this.svgNode.flipLabel && this.dataType !== 'typeCategory')
      degrees = this.degrees + 90 * (onLeftSide ? -1 : 1)
      length = this.ui.settings.lineWidth
    }

    const toOrigin = new LineCoordinates({
      x1: this.svgNode.originPoint.x,
      y1: this.svgNode.originPoint.y,
      degrees,
      length
    })

    this.originPoint = {
      x: toOrigin.x2,
      y: toOrigin.y2
    }
    return this
  }
  draw () {
    this.setCoordinates()

    let previousX = this.originPoint.x
    let previousY = this.originPoint.y

    this.d3Shapes.each((segmentDatum, index, nodes) => {
      const d3LineSegment = d3.select(nodes[index])

      const segmentLine = new LineCoordinates({
        x1: previousX,
        y1: previousY,
        degrees: this.degrees,
        length: this.length * segmentDatum[1]
      })

      previousX = segmentLine.x2
      previousY = segmentLine.y2

      d3LineSegment.attr('x1', segmentLine.x1)
      d3LineSegment.attr('x2', segmentLine.x2)
      d3LineSegment.attr('y1', segmentLine.y1)
      d3LineSegment.attr('y2', segmentLine.y2)
    })
  }
}

class SvgBubble extends SvgNodeElement {
  setData (layoutNode) {
    super.setData(layoutNode)
    this.arcData = d3.pie().value((arcDatum) => arcDatum[1])(this.decimalsArray)
    return this
  }
  initializeFromData () {
    const d3Enter = this.d3Group.selectAll('path.segmented-bubble')
      .data(this.arcData)
      .enter()

    const classPrepend = this.dataType === 'typeCategory' ? 'type' : 'party'
    const highlightEvent = this.dataType === 'typeCategory' ? 'highlightType' : 'highlightParty'

    this.d3Shapes = d3Enter.append('path')
      .attr('class', arcDatum => `line-segment ${classPrepend}-${arcDatum.data[0]}`)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', arcDatum => this.ui.emit(highlightEvent, arcDatum.data[0]))
      .on('mouseout', () => this.ui.emit(highlightEvent, null))

    return this
  }
  setCoordinates () {
    this.circleCentre = this.svgNode.circleCentre
    this.radius = this.svgNode.getRadius() - (this.dataType === 'typeCategory' ? this.ui.settings.lineWidth * 2 : 0)
  }
  draw () {
    this.setCoordinates()

    const arcMaker = d3.arc()
      .innerRadius(this.radius)
      .outerRadius(this.radius)

    this.d3Shapes
      .attr('d', arcDatum => arcMaker(arcDatum))
      .attr('transform', `translate(${this.circleCentre.x}, ${this.circleCentre.y})`)
  }
}

class SvgSpiral extends SvgNodeElement {
}

module.exports = SvgNodeSection
