'use strict'

const d3 = require('./d3-subset.js')
const SvgContentGroup = require('./svg-content.js')
const LineCoordinates = require('../layout/line-coordinates.js')

class Bubbles extends SvgContentGroup {
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

  setData () {
    const dataArray = [...this.ui.layout.layoutNodes.values()]
    const identfier = '.bubbles-group .bubble-wrapper'
    super.setData(dataArray, identfier)
  }

  initializeFromData () {
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
      .on('mouseover', d => this.ui.highlightNode(d))
      .on('mouseout', () => this.ui.highlightNode(null))
      .on('click', (d, e) => {
        d3.event.stopPropagation()
        this.ui.selectNode(d)
      })

    this.addCircles()
    if (this.nodeType === 'ClusterNode') this.addTypeDonuts()

    this.addLabels()
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

  getTransformPosition (d, backwardsOffset = 0) {
    const position = this.getNodePosition(d)
    let { x, y } = position
    const connection = this.getInboundConnection(d)

    const isBelowBackwardsThreshold = d.children.length ? this.isBelowVisibilityThreshold(d) : this.isBelowLabelThreshold(d)

    if (isBelowBackwardsThreshold && connection && this.ui.layout.layoutNodes.has(connection.sourceNode.id)) {
      // Move it back to the mid point of the gap
      const inboundLine = this.getInboundLine(d)
      const backwardsLine = new LineCoordinates({
        x1: x,
        y1: y,
        length: this.ui.settings.labelMinimumSpace / 2 + backwardsOffset,
        degrees: LineCoordinates.enforceDegreesRange(inboundLine.degrees - 180)
      })
      x = backwardsLine.x2
      y = backwardsLine.y2
    }

    return `translate(${x},${y})`
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

      const decimalsAsArray = []
      for (const label of d.node.decimals.typeCategory.within.keys()) {
        const decimal = d.node.getDecimal('typeCategory', 'within', label)
        decimalsAsArray.push([label, decimal])
      }

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
    const {
      labelMinimumSpace,
      strokePadding,
      lineWidth
    } = this.ui.settings

    if (this.typeDonutsMap) {
      for (const [d, donutWrapper] of this.typeDonutsMap) {
        const donutRadius = this.getRadius(d) - strokePadding

        const arcMaker = d3.arc()
          .innerRadius(donutRadius)
          .outerRadius(donutRadius)

        donutWrapper.selectAll('.donut-segment')
          .attr('d', arcDatum => arcMaker(arcDatum))
      }
    }

    this.d3Bubbles.each((d, i, nodes) => {
      const d3BubbleWrapper = d3.select(nodes[i])

      const d3OuterCircle = d3BubbleWrapper.select('.bubble-outer')
      const d3InnerCircle = d3BubbleWrapper.select('.bubble-inner')
      const d3NameLabel = d3BubbleWrapper.select('.name-label')
      const d3TimeLabel = d3BubbleWrapper.select('.time-label')

      // Establish relative size and inbound angle for this bubble
      let inboundDegrees = 90
      let useLongerLabel = !this.isBelowLabelThreshold(d)
      let useMicroLabel = false
      if (d.parent) {
        const connection = this.getInboundConnection(d)
        const length = connection.getVisibleLineLength()
        const hasLongInboundLine = this.hasLongInboundLine(length)
        useLongerLabel = useLongerLabel || hasLongInboundLine
        useMicroLabel = !useLongerLabel && this.hasShortInboundLine(length)
        d3NameLabel.classed('above-inbound-line-threshold', hasLongInboundLine)
        inboundDegrees = this.getInboundLine(d).degrees
      }
      const labelPointsOnwards = !useLongerLabel && !d.children.length && (inboundDegrees < 45 || inboundDegrees > 135)
      const backwardsOffset = labelPointsOnwards ? labelMinimumSpace / 2 + lineWidth : 0

      d3BubbleWrapper.attr('transform', this.getTransformPosition(d, backwardsOffset))

      d3OuterCircle.attr('r', this.getRadius(d))
      d3InnerCircle.attr('r', this.isBelowStrokeThreshold(d) ? labelMinimumSpace : this.getRadius(d) - strokePadding)

      const withinTime = this.ui.formatNumber(d.node.getWithinTime())
      const withinTimeMs = withinTime + (this.getRadius(d) < labelMinimumSpace ? '' : '\u2009ms')
      d3TimeLabel.text(withinTimeMs)

      if (d.node.name === 'miscellaneous' && !d.parent) {
        d3NameLabel.text('Starts here')
      } else if (useLongerLabel) {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 4, 21))
      } else if (useMicroLabel) {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 1, 6))
        d3NameLabel.classed('smaller-label', true)
      } else {
        d3NameLabel.text(this.ui.truncateLabel(d.node.name, 1, 9))
      }

      const negateIfOnwardsLabel = labelPointsOnwards ? -1 : 1
      const position = this.getNodePosition(d)
      const lineToLabel = new LineCoordinates({
        x1: position.x,
        y1: position.y,
        length: this.getRadius(d) * negateIfOnwardsLabel + lineWidth - backwardsOffset,
        degrees: LineCoordinates.enforceDegreesRange(inboundDegrees - 180)
      })

      let flipDegreesLabel = false
      let degrees = lineToLabel.degrees
      let xOffset
      let yOffset

      if (labelPointsOnwards) {
        // Draw label after bubble, continuing incoming line
        if (inboundDegrees > 90 || inboundDegrees < -90) {
          d3NameLabel.classed('pointing-left', true)
        } else {
          d3NameLabel.classed('pointing-right', true)
          degrees = LineCoordinates.enforceDegreesRange(degrees + 180)
        }
      } else {
        // Draw label above bubble, perpendicular to incoming line
        degrees += 90

        if (degrees > 90 || degrees < -90) {
          degrees -= 180
          flipDegreesLabel = true
        }
        d3NameLabel.classed('flipped-label', flipDegreesLabel)
      }

      xOffset = lineToLabel.x2 - position.x
      yOffset = lineToLabel.y2 - position.y
      d3NameLabel.attr('transform', `translate(${xOffset}, ${yOffset}) rotate(${degrees})`)
    })
  }
}

module.exports = Bubbles
