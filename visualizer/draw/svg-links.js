'use strict'

const d3 = require('./d3-subset.js')
const SvgContentGroup = require('./svg-content.js')

class Links extends SvgContentGroup {
  constructor (svgContainer, contentProperties) {
    super (svgContainer, contentProperties)

    this.ui.on('setData', () => {
      this.initializeFromData(this.ui.layout.connections)
    })
  }

  getLength (d) {
    return this.ui.layout.scale.getLineLength(d.getBetweenTime())
  }

  initializeFromData (dataArray) {
    super.initializeFromData(dataArray)

    this.d3Element.classed('links-group', true)

    this.d3OuterLines = null
    this.d3InnerLines = null
    this.d3Links = this.d3Enter.append('g')
      // Match the stacking order of the source bubbles
      .sort((a, b) => this.getRadius(b.sourceNode) - this.getRadius(a.sourceNode))

      .attr('class', d => `party-${d.mark.get('party')}`)
      .classed('link-wrapper', true)
      .classed('below-label-threshold', (d) => this.getLength(d) < this.ui.settings.minimumLabelSpace)
      .classed('below-visibility-threshold', (d) => this.getLength(d) < 1)

    this.addLines()

    if (this.nodeType === 'ClusterNode') { this.addLineSegments() }
  }

  addLines () {
    this.d3OuterLines = this.d3Bubbles.append('path')
      .classed('link-outer', true)
      .style('stroke-width', this.ui.settings.strokeWidthOuter)

    this.d3InnerLines = this.d3Bubbles.append('line')
      .classed('link-inner', true)
      .style('stroke-width', this.ui.settings.strokeWidthInner)
  }

  addLineSegments () {
    this.segmentedLinesMap = new Map()

    const linesWithSegments = this.d3Bubbles.filter('.link-wrapper:not(.below-visibility-threshold)')
  }

  draw () {
  }
}

module.exports = Links
