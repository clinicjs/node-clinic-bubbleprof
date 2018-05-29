'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')

class LineChart extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)

    this.xScale = d3.scaleTime()
    this.xAxis = d3.axisBottom().scale(this.xScale)

    this.yScale = d3.scaleLinear()
    this.yAxis = d3.axisLeft().scale(this.yScale)

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
  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('line-chart', true)

    this.d3LineChartSVG = this.d3ContentWrapper.append('svg')
      .classed('line-chart-svg', true)

    this.d3LinesGroup = this.d3LineChartSVG.append('g')
      .classed('lines-group', true)

    this.d3AxisGroup = this.d3LineChartSVG.append('g')
      .classed('axis-group', true)
  }
  setData () {
    const {
      wallTime,
      aggregateNodes
    } = this.ui.dataSet

    this.xScale.domain([wallTime.profileStart, wallTime.profileEnd])
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
        time: wallTime.profileStart + index * wallTime.msPerSlice
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
      .classed('area-line', true)
  }
  draw () {
    super.draw()
    const {
      width,
      height
    } = this.d3LineChartSVG.node().getBoundingClientRect()

    this.xScale.range([0, width])
    this.yScale.range([height, 0])

    this.d3Lines.attr('d', this.areaMaker)
  }
}

module.exports = LineChart
