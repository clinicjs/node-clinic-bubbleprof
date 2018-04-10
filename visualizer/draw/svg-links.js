'use strict'

const d3 = require('./d3-subset.js')
const SvgContentGroup = require('./svg-content.js')
const LineCoordinates = require('../layout/line-coordinates.js')

class Links extends SvgContentGroup {
  constructor (svgContainer, contentProperties) {
    super(svgContainer, contentProperties)

    this.ui.on('setData', () => {
      this.initializeFromData(this.ui.layout.connections)
    })
  }

  initializeFromData (dataArray) {
    super.initializeFromData(dataArray)

    this.d3Element.classed('links-group', true)

    this.d3OuterLines = null
    this.d3InnerLines = null
    this.d3Links = this.d3Enter.append('g')
      // Match the stacking order of the source bubbles
      .sort((a, b) => b.getSourceRadius() - a.getSourceRadius())

      .attr('class', connection => `party-${connection.targetNode.mark.get('party')}`)
      .classed('link-wrapper', true)
      .classed('below-label-threshold', (connection) => connection.getVisibleLineLength() < this.ui.settings.minimumLabelSpace)
      .classed('below-visibility-threshold', (connection) => connection.getVisibleLineLength() < 1)

    this.addLines()

    if (this.nodeType === 'ClusterNode') { this.addLineSegments() }
  }

  addLines () {
    this.d3OuterLines = this.d3Links.append('path')
      .classed('link-outer', true)
      .classed('by-variable', true)
      .style('stroke-width', this.ui.settings.strokeWidthOuter)

    this.d3InnerLines = this.d3Links.append('line')
      .classed('link-inner', true)
      .style('stroke-width', this.ui.settings.strokeWidthInner)
  }

  addLineSegments () {
    this.segmentedLinesMap = new Map()

    const linesWithSegments = this.d3Links.filter('.link-wrapper:not(.below-visibility-threshold)')

    linesWithSegments.each((connection, i, nodes) => {
      const link = d3.select(nodes[i])
      const targetNode = connection.targetNode
      const decimalsAsArray = Array.from(targetNode.decimals.typeCategory.between.entries())

      link.append('g')
        .classed('link-segments', true)
        .selectAll('line.link-segment')
        .data(decimalsAsArray)
        .enter()
        .append('line')
        .attr('class', decimal => `type-${decimal[0].replace('/', '-')}`)
        .classed('link-segment', true)
        .on('mouseover', () => { this.ui.highlightType(targetNode.typeCategory) })
        .on('mouseout', () => { this.ui.highlightType(null) })

      this.segmentedLinesMap.set(connection, link.selectAll('line.link-segment'))
    })
  }

  getOuterLinePath (radiusOffset, length) {
    // Returns a path definition for a path around a line shaped like ■■■■■■■■■■▶
    const degrees = radiusOffset.degrees

    const toLineEndpoint = new LineCoordinates({
      x1: radiusOffset.x2,
      y1: radiusOffset.y2,
      length: length,
      degrees
    })
    const topLeft = new LineCoordinates({
      x1: radiusOffset.x2,
      y1: radiusOffset.y2,
      length: this.ui.settings.strokePadding,
      degrees: degrees - 90
    })
    const bottomLeft = new LineCoordinates({
      x1: radiusOffset.x2,
      y1: radiusOffset.y2,
      length: this.ui.settings.strokePadding,
      degrees: degrees + 90
    })
    const topRight = new LineCoordinates({
      x1: toLineEndpoint.x2,
      y1: toLineEndpoint.y2,
      length: this.ui.settings.strokePadding,
      degrees: degrees - 90
    })
    const bottomRight = new LineCoordinates({
      x1: toLineEndpoint.x2,
      y1: toLineEndpoint.y2,
      length: this.ui.settings.strokePadding,
      degrees: degrees + 90
    })
    const tip = new LineCoordinates({
      x1: toLineEndpoint.x2,
      y1: toLineEndpoint.y2,
      length: this.ui.settings.strokePadding,
      degrees
    })
    return `M${topLeft.x2},${topLeft.y2}L${topRight.x2},${topRight.y2}L${tip.x2},${tip.y2}` +
      `L${bottomRight.x2},${bottomRight.y2}L${bottomLeft.x2},${bottomLeft.y2}`
  }

  draw () {
    const outerLinesArray = this.d3OuterLines.nodes()
    const innerLinesArray = this.d3InnerLines.nodes()

    this.d3Links.each((connection, linkIndex, nodes) => {
      const d3OuterLine = d3.select(outerLinesArray[linkIndex])
      const d3InnerLine = d3.select(innerLinesArray[linkIndex])

      const positions = this.ui.layout.positioning.nodeToPosition
      const sourcePositions = positions.get(connection.sourceNode)
      const targetPositions = positions.get(connection.targetNode)

      const connectCentresCoords = new LineCoordinates({
        x1: sourcePositions.x,
        y1: sourcePositions.y,
        x2: targetPositions.x,
        y2: targetPositions.y
      })
      Links.applyLineXYs(d3InnerLine, connectCentresCoords)

      const sourceRadius = connection.getSourceRadius()

      // Use this offset to start lines at outer rim of circle radius
      const offsetLength = sourceRadius + this.ui.settings.strokeWidthOuter / 2
      const offsetBeforeLine = new LineCoordinates({
        radians: connectCentresCoords.radians,
        length: offsetLength,
        x1: connectCentresCoords.x1,
        y1: connectCentresCoords.y1
      })

      const visibleLength = connection.getVisibleLineLength()
      d3OuterLine.attr('d', this.getOuterLinePath(offsetBeforeLine, visibleLength))

      if (this.segmentedLinesMap.has(connection)) {
        const d3SegmentsGroup = this.segmentedLinesMap.get(connection)

        let segmentCoordinates = offsetBeforeLine

        d3SegmentsGroup.each((decimal, segmentIndex, nodes) => {
          const d3LineSegment = d3.select(nodes[segmentIndex])
          const segmentLength = visibleLength * decimal[1]

          // Endpoint of the last segment becomes the start point / offset of the next
          segmentCoordinates = new LineCoordinates({
            x1: segmentCoordinates.x2,
            y1: segmentCoordinates.y2,
            length: segmentLength,
            radians: segmentCoordinates.radians
          })

          Links.applyLineXYs(d3LineSegment, segmentCoordinates)
        })
      }
    })
  }

  static applyLineXYs (d3Line, lineCoords) {
    d3Line.attr('x1', lineCoords.x1)
    d3Line.attr('x2', lineCoords.x2)
    d3Line.attr('y1', lineCoords.y1)
    d3Line.attr('y2', lineCoords.y2)
  }
}

module.exports = Links
