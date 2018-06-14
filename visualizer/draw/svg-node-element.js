'use strict'

const d3 = require('./d3-subset.js')

class SvgNodeElement {
  constructor (parentContent, d3Group, dataType) {
    this.svgNode = parentContent
    this.d3Group = d3Group
    this.ui = parentContent.ui

    this.dataPosition = parentContent.dataPosition
    this.dataType = dataType
  }
  setData (layoutNode) {
    this.decimalsArray = layoutNode.getDecimalsArray(this.dataType, this.dataPosition)

    return this
  }
  completeInitialize (classNames = '') {
    this.d3Shapes
      .attr('class', decimal => `${classNames} ${this.dataType}-${decimal[0]}`)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', decimal => this.ui.emit('highlightType', decimal[0]))
      .on('mouseout', () => this.ui.emit('highlightType', null))

    this.d3Group
      .on('mouseover', layoutNode => this.ui.highlightNode(layoutNode))
      .on('mouseout', () => this.ui.highlightNode(null))
      .on('click', connection => {
        d3.event.stopPropagation()
        this.ui.selectNode(layoutNode)
      })
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

    this.d3Shapes = d3Enter.append('line')
      .on('mouseover', decimal => this.ui.emit('highlightType', decimal[0]))
      .on('mouseout', () => this.ui.emit('highlightType', null))

    this.completeInitialize('line-segment')
    return this
  }
  draw () {

  }
}

class SvgBubble extends SvgNodeElement {
  setData (layoutNode) {
    super.setData(layoutNode)
    this.arcData = d3.pie().value((arcDatum) => arcDatum[1])(decimalsArray)
  }
  initializeFromData () {
    const d3Enter = this.d3Group.selectAll('path.segmented-bubble')
      .data(this.decimalsArray)
      .enter()

    this.d3Shapes = d3Enter.append('line')
      .on('mouseover', decimal => this.ui.emit('highlightType', decimal[0]))
      .on('mouseout', () => this.ui.emit('highlightType', null))

    this.completeInitialize('line-segment')
    return this
  }
  draw () {

  }
}

class SvgSpiral extends SvgNodeElement {
}

module.exports = {
  SvgBubble,
  SvgLine,
  SvgSpiral
}
