'use strict'

const d3 = require('./d3-subset.js')
const SvgContentGroup = require('./svg-content.js')
const LineCoordinates = require('../layout/line-coordinates.js')

class Bubbles extends SvgContentGroup {
  constructor (svgContainer, contentProperties) {
    super(svgContainer, contentProperties)

    this.ui.on('setData', () => {
      this.initializeFromData([...this.ui.layout.layoutNodes.values()])
    })
  }

  isBelowLabelThreshold (d) {
    return this.getRadius(d) < this.ui.settings.labelMinimumSpace
  }
  isBelowStrokeThreshold (d) {
    return this.getRadius(d) < this.ui.settings.strokePadding
  }
  isBelowVisibilityThreshold (d) {
    return this.getRadius(d) < 1
  }
  hasLongInboundLine (length) {
    return length > this.ui.settings.labelMinimumSpace * 5
  }
  hasShortInboundLine (length) {
    return length < this.ui.settings.labelMinimumSpace
  }

  initializeFromData (dataArray) {
    super.initializeFromData(dataArray)

    this.d3Element.classed('bubbles-group', true)

    this.d3OuterCircles = null
    this.d3InnerCircles = null

    this.arcData = null
    this.typeDonutsMap = null

    this.d3Bubbles = this.d3Enter.append('g')
      // In rare cases, there is an unavoidable overlap of bubbles. There's no svg z-index
      // so we sort the appending such that smallest bubbles stack above larger bubbles
      .sort((a, b) => this.getRadius(b) - this.getRadius(a))

      .attr('id', d => `${d.node.constructor.name}-${d.id}`)
      .attr('class', d => `party-${d.node.mark.get('party')}`)
      .classed('bubble-wrapper', true)
      .classed('below-threshold-1', (d) => this.isBelowLabelThreshold(d))
      .classed('below-threshold-2', (d) => this.isBelowStrokeThreshold(d))
      .classed('below-threshold-3', (d) => this.isBelowVisibilityThreshold(d))
      .on('mouseover', d => this.ui.emit('hover', d))
      .on('mouseout', () => this.ui.emit('hover', null))
      .on('click', (d, e) => {
        d3.event.stopPropagation()
        this.ui.selectNode(d)
      })

    this.addCircles()
    this.addLabels()

    if (this.nodeType === 'ClusterNode') this.addTypeDonuts()
  }

  getNodePosition (layoutNode) {
    return layoutNode.position
  }

  getRadius (layoutNode) {
    return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
  }

  getInboundConnection (layoutNode) {
    return layoutNode.inboundConnection
  }

  getInboundLine (d) {
    const connection = this.getInboundConnection(d)
    const position = this.getNodePosition(d)
    const sourcePosition = this.getNodePosition(connection.sourceLayoutNode)
    return new LineCoordinates({
      x1: sourcePosition.x,
      y1: sourcePosition.y,
      x2: position.x,
      y2: position.y
    })
  }

  getTransformPosition (d, xOffset = 0, yOffset = 0) {
    const position = this.getNodePosition(d)
    let { x, y } = position
    const connection = this.getInboundConnection(d)

    if (this.isBelowVisibilityThreshold(d) && connection && this.ui.layout.layoutNodes.has(connection.sourceNode.id)) {
      // Move it back to the mid point of the gap
      const inboundLine = this.getInboundLine(d)
      const backwardsLine = new LineCoordinates({
        x1: x,
        y1: y,
        length: this.ui.settings.labelMinimumSpace / 2,
        degrees: LineCoordinates.enforceDegreesRange(inboundLine.degrees - 180)
      })
      x = backwardsLine.x2
      y = backwardsLine.y2
    }

    return `translate(${x + xOffset},${y + yOffset})`
  }

  addCircles () {
    this.d3OuterCircles = this.d3Bubbles.append('circle')
      .classed('bubble-outer', true)
      .classed('by-variable', true)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', d => this.ui.emit('highlightParty', d.node.mark.get('party')))
      .on('mouseout', () => this.ui.emit('highlightParty', null))

    this.d3InnerCircles = this.d3Bubbles.append('circle')
      .classed('bubble-inner', true)
  }

  addLabels () {
    this.d3TimeLabels = this.d3Bubbles.append('text')
      .classed('time-label', true)
      .classed('text-label', true)

    this.d3NameLabels = this.d3Bubbles.append('text')
      .classed('name-label', true)
      .classed('text-label', true)
  }

  addTypeDonuts () {
    // Too-small clusterNodes in dataArray won't have a donut, so rather than have an incomplete
    // selection or array, reference them from a map keyed by d index
    this.typeDonutsMap = new Map()

    const bubblesWithDonuts = this.d3Bubbles.filter('.bubble-wrapper:not(.below-stroke-threshold)')

    bubblesWithDonuts.each((d, i, nodes) => {
      const bubble = d3.select(nodes[i])

      const donutWrapper = bubble.append('g')
        .classed('bubble-donut', true)

      this.typeDonutsMap.set(d, donutWrapper)

      const decimalsAsArray = Array.from(d.node.decimals.typeCategory.within.entries())

      // Creates array of data objects like:
      // { data: ['name', 0.123], index: n, value: 0.123, startAngle: x.yz, endAngle: x.yz, padAngle: 0 }
      const arcData = d3.pie()
        .value((arcDatum) => arcDatum[1])(decimalsAsArray)

      donutWrapper.selectAll('.donut-segment')
        .data(arcData)
        .enter()
        .append('path')
        .attr('class', arcDatum => `type-${arcDatum.data[0]}`)
        .style('stroke-width', this.ui.settings.lineWidth)
        .classed('donut-segment', true)
        .on('mouseover', arcDatum => this.ui.emit('highlightType', arcDatum.data[0]))
        .on('mouseout', () => this.ui.emit('highlightType', null))
    })
  }
  draw () {
    this.d3OuterCircles.attr('r', d => this.getRadius(d))

    this.d3InnerCircles.attr('r', d => {
      // If below threshold, this will be an invisible mouseover target
      return this.isBelowStrokeThreshold(d) ? this.ui.settings.labelMinimumSpace : this.getRadius(d) - this.ui.settings.strokePadding
    })

    if (this.typeDonutsMap) {
      for (const [d, donutWrapper] of this.typeDonutsMap) {
        const donutRadius = this.getRadius(d) - this.ui.settings.strokePadding

        const arcMaker = d3.arc()
          .innerRadius(donutRadius)
          .outerRadius(donutRadius)

        donutWrapper.selectAll('.donut-segment')
          .attr('d', arcDatum => arcMaker(arcDatum))
      }
    }
    this.d3Bubbles.attr('transform', d => this.getTransformPosition(d))

    this.d3TimeLabels.text(d => {
      const withinTime = this.ui.formatNumber(d.node.getWithinTime())
      const withMs = withinTime + (this.getRadius(d) < this.ui.settings.labelMinimumSpace ? '' : '\u2009ms')
      return withMs
    })

    this.d3NameLabels.each((d, i, nodes) => {
      const d3NameLabel = d3.select(nodes[i])
      let inboundDegrees = 90
      let useLongerLabel = true
      let useMicroLabel = false

      if (d.parent) {
        const connection = this.getInboundConnection(d)
        const length = connection.getVisibleLineLength()
        const hasLongInboundLine = this.hasLongInboundLine(length)

        useLongerLabel = !this.isBelowLabelThreshold(d) || hasLongInboundLine
        useMicroLabel = !useLongerLabel && this.hasShortInboundLine(length)

        d3NameLabel.classed('above-inbound-line-threshold', hasLongInboundLine)
        inboundDegrees = this.getInboundLine(d).degrees
      }

      if (d.name === 'miscellaneous' && !d.parent) {
        d3NameLabel.text('Starts here')
      } else if (useLongerLabel) {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 4, 21))
      } else if (useMicroLabel) {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 1, 6))
        d3NameLabel.classed('smaller-label', true)
      } else {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 1, 9))
      }

      const position = this.getNodePosition(d)
      const lineToLabel = new LineCoordinates({
        x1: position.x,
        y1: position.y,
        length: this.getRadius(d) + this.ui.settings.lineWidth,
        degrees: LineCoordinates.enforceDegreesRange(inboundDegrees - 180)
      })

      let degrees = lineToLabel.degrees + 90
      let flipDegreesLabel = false

      if (degrees > 90 || degrees < -90) {
        degrees -= 180
        flipDegreesLabel = true
      }
      d3NameLabel.classed('flipped-label', flipDegreesLabel)

      const xOffset = lineToLabel.x2 - position.x
      const yOffset = lineToLabel.y2 - position.y

      d3NameLabel.attr('transform', `translate(${xOffset}, ${yOffset}) rotate(${degrees})`)
    })
  }
}

module.exports = Bubbles
