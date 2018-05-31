'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')

class LineChart extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, Object.assign({
      static: true,
      margins: {
        top: 0,
        left: 6,
        right: 6,
        bottom: 12
      }
    }, contentProperties))

    this.xScale = d3.scaleTime()
    this.yScale = d3.scaleLinear()

    this.pixelsPerSlice = 0

    this.areaMaker = d3.area()
      .x(d => this.xScale(d.data.time))
      .y0(d => this.yScale(d[0]))
      .y1(d => this.yScale(d[1]))

    this.ui.on('setData', () => {
      this.setData()
    })
    this.ui.on('initializeFromData', () => {
      this.initializeFromData()
    })
  }
  getAggregateNode (id) {
    return this.ui.dataSet.aggregateNodes.get(id)
  }
  initializeElements () {
    super.initializeElements()
    const margins = this.contentProperties.margins

    this.d3Element.classed('line-chart', true)

    this.d3ChartWrapper = this.d3ContentWrapper.append('div')
      .classed('line-chart', true)

    this.d3LeadInText = this.d3ChartWrapper.append('p')
      .classed('lead-in-text', true)

    this.d3LineChartSVG = this.d3ChartWrapper.append('svg')
      .classed('line-chart-svg', true)

    this.d3LineChartGroup = this.d3LineChartSVG.append('g')
      .attr('transform', `translate(${margins.left}, ${margins.top})`)

    this.d3LinesGroup = this.d3LineChartGroup.append('g')
      .classed('lines-group', true)

    this.d3XAxisGroup = this.d3LineChartGroup.append('g')
      .classed('axis-group', true)
      .classed('x-axis', true)

    this.hoverBox = this.addContent('HoverBox', {
      type: 'tool-tip',
      allowableOverflow: 24
    })
    this.hoverBox.initializeElements()

    this.d3SliceHighlight = this.d3ChartWrapper.append('div')
      .classed('slice-highlight', true)
      .classed('hidden', true)
  }
  setData () {
    const {
      wallTime,
      aggregateNodes
    } = this.ui.dataSet

    this.slicesCount = wallTime.slicesCount

    this.xScale.domain([0, wallTime.profileEnd - wallTime.profileStart])
    this.yScale.domain([0, wallTime.maxAsyncPending])

    // Sort by category (same colours together) or if equal, by id (how early defined)
    this.aggregateIds = [...aggregateNodes.keys()].sort((a, b) => {
      const aNode = aggregateNodes.get(a)
      const bNode = aggregateNodes.get(b)
      if (aNode.typeCategory !== bNode.typeCategory) {
        const aIndex = wallTime.categoriesOrdered.indexOf(aNode.typeCategory)
        const bIndex = wallTime.categoriesOrdered.indexOf(bNode.typeCategory)
        return aIndex - bIndex
      }
      return a - b
    })

    const aggregateIdsCount = this.aggregateIds.length
    this.dataArray = wallTime.slices.map((item, index) => {
      const dataItem = {
        time: index * wallTime.msPerSlice
      }
      for (var i = 0; i < aggregateIdsCount; i++) {
        dataItem[this.aggregateIds[i]] = item.asyncPending.byAggregateId[this.aggregateIds[i]] || 0
      }
      return dataItem
    })

    const dataStacker = d3.stack()
      .keys(this.aggregateIds)

    this.stackedData = dataStacker(this.dataArray)

    // Refresh on data / layout update. This includes screen resize
    if (!this.hidden) {
      this.initializeFromData()
      this.draw()
    }
  }
  initializeFromData () {
    if (this.d3Lines) {
      this.d3Lines.data(this.stackedData)
      return
    }
    this.d3Lines = this.d3LinesGroup.selectAll('.area-line')
      .data(this.stackedData)
      .enter()
      .append('path')
      .attr('class', d => `type-${this.getAggregateNode(d.key).typeCategory}`)
      .classed('area-line-even', d => !(d.index % 2))
      .classed('area-line', true)
      .on('mouseover', (d) => {
        if (this.layoutNode) return
        const aggregateNode = this.getAggregateNode(d.key)
        const layoutNode = this.ui.layout.findAggregateNode(aggregateNode)
        if (layoutNode) {
          this.ui.highlightNode(layoutNode, aggregateNode)
        }
      })
      .on('mouseout', () => {
        if (this.layoutNode) return
        this.ui.highlightNode(null)
      })
      .on('click', (d) => {
        const aggregateNode = this.getAggregateNode(d.key)
        this.ui.jumpToAggregateNode(aggregateNode)
      })
      .on('mousemove', () => {
        this.showSlice(d3.event)
      })

    // Same behaviour on mouse movements off coloured area as on
    this.d3LineChartSVG.on('mousemove', () => {
      this.showSlice(d3.event)
    })

    this.d3ContentWrapper.on('mouseleave', () => {
      this.hoverBox.hide()
      this.d3SliceHighlight.classed('hidden', true)
    })

    if (this.contentProperties.static) this.d3LeadInText.html(this.getLeadInText())
  }
  applyLayoutNode (layoutNode = null) {
    this.layoutNode = layoutNode
  }
  layoutNodeHasAggregateId (aggregateId) {
    const aggregateNode = this.getAggregateNode(aggregateId)
    const layoutNode = this.ui.layout.findAggregateNode(aggregateNode)
    return (layoutNode === this.layoutNode)
  }
  getLeadInText () {
    /* TODO: Enable this, adding lead in text to hover boxes, when nodes on diagram are drawn based on async / sync not within / between
    if (this.layoutNode) {
      const dataNode = this.layoutNode.node
      console.log(this.layoutNode)
      return `
        For ${dataNode.getAsyncTime().toFixed(0)} milliseconds of the runtime of this profile,
        an async resource from this grouping was pending. For ${dataNode.getSyncTime().toFixed(0)} milliseconds, an async resource was
        active running a syncronous process.
      `
    }
    */
    return `
      <strong>${this.ui.dataSet.callbackEventsCount}</strong> calls were made
      to ${this.ui.dataSet.sourceNodesCount} asyncronous resources, over a time period
      of ${(this.ui.dataSet.wallTime.profileDuration).toFixed(0)} milliseconds.
    `
  }
  showSlice (event) {
    const { offsetX } = event
    // Note: d3.event is a live binding which fails if d3 is not bundled in a recommended way.
    // See, for example, https://github.com/d3/d3-sankey/issues/30#issuecomment-307869620

    const {
      width,
      height
    } = this.d3LineChartSVG.node().getBoundingClientRect()
    const margins = this.contentProperties.margins

    // Show nothing if mouse movement is within chart margins
    if (offsetX <= margins.left || offsetX + margins.left >= width) {
      this.d3SliceHighlight.classed('hidden', true)
      return
    }

    const leftPosition = offsetX - margins.left
    const wrapperHeight = this.d3ChartWrapper.node().getBoundingClientRect().height

    const index = Math.floor(leftPosition / this.pixelsPerSlice)
    const timeSliceData = this.dataArray[index]

    const value = this.aggregateIds.reduce((accum, aggregateId) => {
      if (this.layoutNode && !this.layoutNodeHasAggregateId(aggregateId)) return accum
      return accum + timeSliceData[aggregateId]
    }, 0)

    const topOffset = wrapperHeight - height - margins.bottom
    const leftOffset = this.pixelsPerSlice * index + margins.left

    this.d3SliceHighlight
      .classed('hidden', false)
      .style('left', leftOffset + 'px')

    const pluralize = value === 1 ? '' : 's'
    this.hoverBox.showContentAt(`<strong>${value}</strong> pending async operation${pluralize}`, {
      x: leftOffset + this.pixelsPerSlice / 2,
      y: topOffset
    })
    this.hoverBox.d3Element.classed('off-bottom', true)
  }
  draw () {
    super.draw()
    const {
      width,
      height
    } = this.d3LineChartSVG.node().getBoundingClientRect()
    const margins = this.contentProperties.margins

    const usableHeight = height - margins.bottom - margins.top
    const usableWidth = width - margins.left - margins.right

    // If a layoutNode has been assigned, de-emphasise everything that's not in it
    if (this.layoutNode) {
      /* TODO: Enable this when nodes on diagram are drawn based on async / sync not within / between
      this.d3LeadInText.html(this.getLeadInText())
      */

      this.d3LineChartSVG.classed('filter-applied', true)
      this.d3Lines.classed('filtered', d => {
        if (!this.layoutNode) return false
        return !this.layoutNodeHasAggregateId(d.key)
      })
      if (this.ui.highlightedDataNode) {
        this.d3Lines.classed('not-emphasised', d => {
          const aggregateNode = this.getAggregateNode(d.key)
          return (aggregateNode !== this.ui.highlightedDataNode)
        })
      }
    } else {
      this.d3LineChartSVG.classed('filter-applied', false)
      this.d3Lines.classed('filtered', false)
    }

    this.xScale.range([0, usableWidth])
    this.yScale.range([usableHeight, 0])

    this.d3Lines.attr('d', this.areaMaker)

    const xAxis = d3.axisBottom()
      .ticks(width < 160 ? 5 : 9) // Show fewer ticks if less space is available
      .tickSize(2)
      .tickPadding(3)
      .scale(this.xScale)
      .tickFormat((dateStamp) => {
        const hairSpace = ' ' // &hairsp; unicode char, SVG doesn't like it as a HTML entity
        switch (true) {
          // Just show a simple '0' for the first axis label i.e. profile start
          case d3.timeFormat('%Q')(dateStamp) === '0':
            return `0${hairSpace}s`
          case d3.timeSecond(dateStamp) < dateStamp:
            // When space is moderately limited, show unlabelled mid point markers between seconds
            if (width < 220) return ''
            return d3.timeFormat('%L')(dateStamp) + `${hairSpace}ms`// milliseconds like '500 ms'
          case d3.timeMinute(dateStamp) < dateStamp:
            return parseInt(d3.timeFormat('%S')(dateStamp)) + `${hairSpace}s`// seconds like '5 s'
          case d3.timeHour(dateStamp) < dateStamp:
            return d3.timeFormat('%M')(dateStamp) + `${hairSpace}min` // minutes like '5 min'
          default:
            return d3.timeFormat('%H')(dateStamp) + `${hairSpace}hr` // hours like '5 hr'
        }
      })

    this.d3XAxisGroup
      .attr('transform', `translate(0, ${usableHeight})`)
      .call(xAxis)

    this.pixelsPerSlice = usableWidth / this.slicesCount

    this.d3SliceHighlight.style('width', Math.max(this.pixelsPerSlice, 1) + 'px')
    this.d3SliceHighlight.style('height', usableHeight + 'px')
    this.d3SliceHighlight.style('bottom', margins.bottom + 'px')
  }
}

module.exports = LineChart
