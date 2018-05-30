'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')

class LineChart extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, Object.assign({
      margins: {
        top: 0,
        left: 6,
        right: 6,
        bottom: 12
      }
    }, contentProperties))

    this.xScale = d3.scaleTime()
    this.yScale = d3.scaleLinear()

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

    this.d3LineChartSVG = this.d3ContentWrapper.append('svg')
      .classed('line-chart-svg', true)

    this.d3LineChartGroup = this.d3LineChartSVG.append('g')
      .attr('transform', `translate(${margins.left}, ${margins.top})`)

    this.d3LinesGroup = this.d3LineChartGroup.append('g')
      .classed('lines-group', true)

    this.d3XAxisGroup = this.d3LineChartGroup.append('g')
      .classed('axis-group', true)
      .classed('x-axis', true)
  }
  setData () {
    const {
      wallTime,
      aggregateNodes
    } = this.ui.dataSet

    this.xScale.domain([0, wallTime.profileEnd - wallTime.profileStart])
    this.yScale.domain([0, wallTime.maxAsyncPending])

    // Sort by category (same colours together) or if equal, by id (how early defined)
    const keys = [...aggregateNodes.keys()].sort((a, b) => {
      const aNode = aggregateNodes.get(a)
      const bNode = aggregateNodes.get(b)
      if (aNode.typeCategory !== bNode.typeCategory) {
        const aIndex = wallTime.categoriesOrdered.indexOf(aNode.typeCategory)
        const bIndex = wallTime.categoriesOrdered.indexOf(bNode.typeCategory)
        return aIndex - bIndex
      }
      return a - b
    })

    const keysLength = keys.length
    const dataArray = wallTime.slices.map((item, index) => {
      const dataItem = {
        time: index * wallTime.msPerSlice
      }
      for (var i = 0; i < keysLength; i++) {
        dataItem[keys[i]] = item.asyncPending.byAggregateId[keys[i]] || 0
      }
      return dataItem
    })

    const dataStacker = d3.stack()
      .keys(keys)

    this.stackedData = dataStacker(dataArray)

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
  }
  applyLayoutNode (layoutNode = null) {
    this.layoutNode = layoutNode
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
      this.d3LineChartSVG.classed('filter-applied', true)
      this.d3Lines.classed('filtered', d => {
        if (!this.layoutNode) return false
        const aggregateNode = this.getAggregateNode(d.key)
        const layoutNode = this.ui.layout.findAggregateNode(aggregateNode)
        return (layoutNode !== this.layoutNode)
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
  }
}

module.exports = LineChart
