'use strict'

const d3 = require('./d3-subset.js')
const SvgContentGroup = require('./svg-content.js')

class Bubbles extends SvgContentGroup {
  constructor (svgContainer, contentProperties) {
    super (svgContainer, contentProperties)

    this.ui.on('setData', () => {
      this.initializeFromData(this.ui.layout.nodes)
    })
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

      .attr('class', d => `party-${d.mark.get('party')}`)
      .classed('bubble-wrapper', true)
      .classed('below-label-threshold', (d) => this.getRadius(d) < this.ui.settings.minimumLabelSpace)
      .classed('below-stroke-threshold', (d) => this.getRadius(d) < this.ui.settings.strokePadding)
      .classed('below-visibility-threshold', (d) => this.getRadius(d) < 1)

    this.addCircles()

    if (this.nodeType === 'ClusterNode') { this.addTypeDonuts() }
  }
  getRadius (d) {
    return this.ui.layout.scale.getCircleRadius(d.getWithinTime())
  }
  addCircles () {
    this.d3OuterCircles = this.d3Bubbles.append('circle')
      .classed('bubble-outer', true)
      .style('stroke-width', this.ui.settings.strokeWidthOuter)

    this.d3InnerCircles = this.d3Bubbles.append('circle')
      .classed('bubble-inner', true)
      .style('stroke-width', this.ui.settings.strokeWidthInner)
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
      this.typeDonutsMap.set(i, donutWrapper)

      const decimalsAsArray = Array.from(d.decimals.typeCategory.within.entries())

      // Creates array of data objects like:
      // { data: ['name', 0.123], index: n, value: 0.123, startAngle: x.yz, endAngle: x.yz, padAngle: 0 }
      const arcData = d3.pie()
        .value((arcDatum) => arcDatum[1])
        (Array.from(d.decimals.typeCategory.within.entries()))

      donutWrapper.selectAll('.donut-segment')
        .data(arcData)
        .enter()
        .append('path')
        .attr('class', arcDatum => `type-${arcDatum.data[0]}`)
        .classed('donut-segment', true)
        .on('mouseover', arcDatum => { this.ui.highlightType(arcDatum.data[0]) })
        .on('mouseout', () => { this.ui.highlightType(null) })

    })
  }
  draw () {
    this.d3OuterCircles.attr('r', d => this.getRadius(d))

    this.d3InnerCircles.each((d, i, nodes) => {
      const innerCircle = d3.select(nodes[i])

      if (d3.select(innerCircle.node().parentNode).classed('below-stroke-threshold')) {
        // This will be an invisible mouseover target
        innerCircle.attr('r', () => this.ui.settings.strokePadding * 2)
      } else {
        // This will be visible, showing the inner part of the circle
        innerCircle.attr('r', () => this.getRadius(d) - this.ui.settings.strokePadding)
      }
    })

    if (this.typeDonutsMap) {
      for (const [i, donutWrapper] of this.typeDonutsMap) {
        const d = this.dataArray[i]
        const donutRadius = this.getRadius(d) - this.ui.settings.strokePadding

        const arcMaker = d3.arc()
          .innerRadius(donutRadius)
          .outerRadius(donutRadius)

        donutWrapper.selectAll('.donut-segment')
          .attr('d', arcDatum => arcMaker(arcDatum))
      }
    }
  }
}

module.exports = Bubbles
