'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')
const {
  numberiseIfNumericString,
  uniqueObjectKey
} = require('../validation.js')

class AreaChart extends HtmlContent {
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

    this.initialized = false
    this.topmostUI = this.ui
    this.xScale = d3.scaleTime()
    this.yScale = d3.scaleLinear()

    this.isInHoverBox = this.parentContent.contentProperties.type === 'node-link'
    this.key = 'AreaChart-' + this.isInHoverBox ? 'HoverBox' : 'SideBar'

    this.pixelsPerSlice = 0
    this.chartHeightScale = 1

    this.layoutNode = null
    this.layoutNodeToApply = null
    this.widthToApply = this.isInHoverBox ? 300 : null

    this.areaMaker = d3.area()
      .x(d => this.xScale(d.data.time))
      .y0(d => this.yScale(d[0]))
      .y1(d => this.yScale(d[1]))

    this.ui.on('setData', () => {
      if (!this.d3AreaPaths) {
        this.setData()
      } else {
        this.updateWidth()
        this.draw()
      }
    })
    this.ui.on('initializeFromData', () => {
      this.initializeFromData()
    })

    this.highlightedLayoutNode = null

    this.hoverListener = layoutNode => {
      if (!this.d3AreaPaths || layoutNode === this.highlightedLayoutNode) return
      this.d3AreaPaths.classed('highlighted', d => layoutNode && extractLayoutNodeId(d.key) === layoutNode.id)
      this.highlightedLayoutNode = layoutNode
    }

    this.ui.on('setTopmostUI', topmostUI => {
      if (this.topmostUI === topmostUI) return
      // Remove listener from old topmostUI
      this.topmostUI.removeListener('hover', this.hoverListener)

      // Add listener to new one
      this.topmostUI = topmostUI
      this.topmostUI.on('hover', this.hoverListener)

      if (this.isInHoverBox) return

      this.createPathsForLayout()
      this.width = null
      this.updateWidth()
      this.draw()
    })
  }
  updateWidth () {
    if (this.isInHoverBox) return
    this.widthToApply = this.d3AreaChartSVG.node().getBoundingClientRect().width
  }
  getAggregateNode (id) {
    return this.ui.dataSet.aggregateNodes.get(id)
  }
  initializeElements () {
    super.initializeElements()
    const margins = this.contentProperties.margins

    this.d3Element.classed('area-chart', true)

    this.d3ChartWrapper = this.d3ContentWrapper.append('div')
      .classed('area-chart', true)

    this.d3AreaChartSVG = this.d3ChartWrapper.append('svg')
      .classed('area-chart-svg', true)

    this.d3ChartOuter = this.d3AreaChartSVG.append('g')
      .classed('chart-outer', true)
      .attr('transform', `translate(${margins.left}, ${margins.top})`)

    this.d3ChartInner = this.d3ChartOuter.append('g')
      .classed('chart-inner', true)

    this.d3XAxisGroup = this.d3ChartOuter.append('g')
      .classed('axis-group', true)
      .classed('x-axis', true)

    this.hoverBox = this.addContent('HoverBox', {
      type: 'tool-tip',
      allowableOverflow: 24,
      fixedOrientation: 'up'
    })
    this.hoverBox.initializeElements()

    this.d3SliceHighlight = this.d3ChartWrapper.append('div')
      .classed('slice-highlight', true)
      .classed('hidden', true)

    this.d3LeadInText = this.d3ChartWrapper.append('p')
      .classed('lead-in-text', true)
  }
  setData () {
    const {
      wallTime,
      aggregateNodes
    } = this.ui.dataSet

    this.slicesCount = wallTime.slicesCount

    this.xScale.domain([0, wallTime.profileEnd - wallTime.profileStart])
    this.yScale.domain([0, wallTime.maxAsyncPending])

    const originalLayout = this.ui.originalUI.layout

    // Sort by category (same colours together), and where same category, by layoutNode
    this.aggregateIds = [...aggregateNodes.keys()].sort((a, b) => {
      const aNode = aggregateNodes.get(a)
      const bNode = aggregateNodes.get(b)

      if (aNode.typeCategory !== bNode.typeCategory) {
        const aIndex = wallTime.categoriesOrdered.indexOf(aNode.typeCategory)
        const bIndex = wallTime.categoriesOrdered.indexOf(bNode.typeCategory)
        return aIndex - bIndex
      }
      const aLayoutNode = originalLayout.findAggregateNode(aNode, true)
      const bLayoutNode = originalLayout.findAggregateNode(bNode, true)

      const aIsInLayout = originalLayout.layoutNodes.has(aLayoutNode.id)
      const bIsInLayout = originalLayout.layoutNodes.has(bLayoutNode.id)

      if (aIsInLayout && bIsInLayout) {
        const sorter = originalLayout.getLayoutNodeSorter()
        return sorter(aLayoutNode, bLayoutNode)
      }
      return a - b
    })

    const aggregateIdsCount = this.aggregateIds.length
    this.dataArray = wallTime.slices.map((timeSlice, index) => {
      // Creates an object for each time slice containing the start time and a key for each aggregateId
      const asyncInSliceByAgId = {
        time: index * wallTime.msPerSlice
      }
      for (var i = 0; i < aggregateIdsCount; i++) {
        // Each aggregateId key is the number of async ops from that aggregate node active in this time slice
        asyncInSliceByAgId[this.aggregateIds[i]] = timeSlice.asyncPending.byAggregateId[this.aggregateIds[i]] || 0
      }
      return asyncInSliceByAgId
    })

    // Refresh on data / layout update. This includes screen resize
    if (!this.hidden) {
      this.initializeFromData()
      this.draw()
    }
  }
  initializeFromData () {
    if (!this.initialized) {
      // These actions aren't redone when data changes, but must be done after data was set
      this.initialized = true

      // Same behaviour on mouse movements off coloured area as on
      this.d3AreaChartSVG.on('mousemove', () => {
        this.showSlice(d3.event)
      })

      this.d3ContentWrapper.on('mouseleave', () => {
        this.hoverBox.hide()
        this.d3SliceHighlight.classed('hidden', true)
      })
    }
    if (this.contentProperties.static) this.d3LeadInText.html(this.getLeadInText())
    if (!this.d3AreaPaths) this.createPathsForLayout()
    this.updateWidth()
  }
  createPathsForLayout () {
    if (this.d3AreaPaths) this.d3AreaPaths.remove()

    const nodeGroups = []

    let currentNodeGroup = applyAggregateIdToNodeGroup(this.aggregateIds[0], this.topmostUI, nodeGroups)

    const aggregateIdsCount = this.aggregateIds.length
    if (aggregateIdsCount > 1) {
      // id [0] has already been done, start iterating at [1]
      for (let aggregateIndex = 1; aggregateIndex < aggregateIdsCount; aggregateIndex++) {
        currentNodeGroup = applyAggregateIdToNodeGroup(this.aggregateIds[aggregateIndex], this.topmostUI, nodeGroups, currentNodeGroup)
      }
    }

    const combinedDataArray = new Array(this.dataArray.length)

    const timeSliceCount = this.dataArray.length
    for (let timeIndex = 0; timeIndex < timeSliceCount; timeIndex++) {
      const oldTimeSlice = this.dataArray[timeIndex]
      combinedDataArray[timeIndex] = { time: oldTimeSlice.time }
      nodeGroups.forEach(nodeGroup => nodeGroup.combineAggregateData(combinedDataArray[timeIndex], oldTimeSlice))
    }

    const nodeGroupKeys = nodeGroups.map(nodeGroup => nodeGroup.key)

    // d3's stacker transposes the data array, so it is by key first in sort order, with each item containing an array
    // of timeslices, then stacks it such that [0] is the total of lower stacks and [1] is [0] + this datapoint
    const dataStacker = d3.stack()
      .keys(nodeGroupKeys)

    const stackedData = dataStacker(combinedDataArray)

    this.d3AreaPaths = this.d3ChartInner.selectAll('.area-path')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('class', d => `type-${d.key.split('_')[0]}`)
      .classed('area-path-even', d => !(d.index % 2))
      .classed('area-path', true)
      .on('mouseover', (d) => {
        const layoutNodeId = extractLayoutNodeId(d.key)
        if (!layoutNodeId || this.isInHoverBox) return

        const layoutNode = this.topmostUI.layout.layoutNodes.get(layoutNodeId)
        if (layoutNode) {
          this.topmostUI.highlightNode(layoutNode)
        }
        this.ui.highlightColour('type', d.key.split('_')[0])
      })
      .on('mouseout', () => {
        if (this.isInHoverBox) return
        this.topmostUI.highlightNode(null)
        this.ui.highlightColour('type', null)
      })
      .on('click', (d) => {
        const layoutNodeId = extractLayoutNodeId(d.key)
        if (!layoutNodeId) return

        this.topmostUI.queueAnimation('selectChartNode', (animationQueue) => {
          this.topmostUI.highlightNode(null)

          const layoutNode = this.topmostUI.layout.layoutNodes.get(layoutNodeId)
          this.topmostUI.selectNode(layoutNode, animationQueue).then(targetUI => {
            if (targetUI !== this.ui) {
              this.ui.originalUI.emit('navigation', { from: this.ui, to: targetUI })
            }
            this.ui.highlightColour('type', null)
            animationQueue.execute()
          })
        })
      })
      .on('mousemove', () => {
        this.showSlice(d3.event)
      })

    if (!this.layoutNodeToApply) this.drawFiltering()
  }

  applyLayoutNode (layoutNode = null) {
    if (layoutNode !== this.layoutNode) {
      this.layoutNodeToApply = layoutNode
    }
    this.updateWidth()
  }
  layoutNodeHasAggregateId (aggregateId) {
    const aggregateNode = this.getAggregateNode(aggregateId)
    const targetUI = this.isInHoverBox ? this.topmostUI : this.topmostUI.parentUI
    const layoutNode = targetUI.layout.findAggregateNode(aggregateNode)
    return (layoutNode === this.layoutNode)
  }
  getLeadInText () {
    const pluralCalls = this.ui.dataSet.callbackEventsCount !== 1
    const pluralResources = this.ui.dataSet.sourceNodesCount !== 1

    return `
      <strong>${this.ui.formatNumber(this.ui.dataSet.callbackEventsCount)} call${pluralCalls ? 's' : ''}</strong>
      to ${this.ui.formatNumber(this.ui.dataSet.sourceNodesCount)} async resource${pluralResources ? 's' : ''}, over
      ${(this.ui.formatNumber(this.ui.dataSet.wallTime.profileDuration))} milliseconds.
    `
  }
  showSlice (event) {
    const { offsetX } = event
    // Note: d3.event is a live binding which fails if d3 is not bundled in a recommended way.
    // See, for example, https://github.com/d3/d3-sankey/issues/30#issuecomment-307869620

    const width = this.d3AreaChartSVG.node().getBoundingClientRect().width
    const margins = this.contentProperties.margins

    // Show nothing if mouse movement is within chart margins
    if (offsetX <= margins.left || offsetX + margins.left >= width) {
      this.d3SliceHighlight.classed('hidden', true)
      return
    }

    const leftPosition = offsetX - margins.left

    const index = Math.floor(leftPosition / this.pixelsPerSlice)
    const timeSliceData = this.dataArray[index]

    const totalOperationsInSlice = this.aggregateIds.reduce((accum, aggregateId) => {
      if (this.layoutNode && !this.layoutNodeHasAggregateId(aggregateId)) return accum
      return accum + timeSliceData[aggregateId]
    }, 0)

    const topOffset = margins.top
    const leftOffset = this.pixelsPerSlice * index + margins.left

    this.d3SliceHighlight
      .classed('hidden', false)
      .style('left', leftOffset + 'px')

    const pluralize = totalOperationsInSlice === 1 ? '' : 's'
    this.hoverBox.showContentAt(`<strong>${totalOperationsInSlice}</strong> pending async operation${pluralize}`, {
      x: leftOffset + this.pixelsPerSlice / 2,
      y: topOffset
    })
    this.hoverBox.d3Element.classed('off-bottom', true)
  }

  drawPathsToFit (width) {
    if (width) this.width = width

    const height = Math.round(70 * this.chartHeightScale)
    const margins = this.contentProperties.margins

    const usableHeight = height - margins.bottom - margins.top
    const usableWidth = width - margins.left - margins.right

    this.xScale.range([0, usableWidth])
    this.yScale.range([usableHeight, 0])

    this.d3AreaChartSVG.style('height', `${height}px`)
    this.d3AreaPaths.attr('d', this.areaMaker)

    const xAxis = d3.axisBottom()
      .ticks(width < 160 ? 5 : 9) // Show fewer ticks if less space is available
      .tickSize(2)
      .tickPadding(3)
      .scale(this.xScale)
      .tickFormat((dateStamp) => {
        const hairSpace = ' ' // &hairsp; unicode char, SVG doesn't like it as a HTML entity

        // Start with 0 s
        if (d3.timeFormat('%Q')(dateStamp) === '0') return `0${hairSpace}s`

        // Show millisecond increments like '500 ms'
        if (d3.timeSecond(dateStamp) < dateStamp) {
          // When space is moderately limited, show unlabelled mid point markers between seconds
          if (width < 220) return ''
          return d3.timeFormat('%L')(dateStamp) + `${hairSpace}ms`
        }
        // Show second increments like '5 s'
        if (d3.timeMinute(dateStamp) < dateStamp) return parseInt(d3.timeFormat('%S')(dateStamp)) + `${hairSpace}s`

        // Show minute increments like '5 min'
        if (d3.timeHour(dateStamp) < dateStamp) return d3.timeFormat('%M')(dateStamp) + `${hairSpace}min`

        // Show hour increments like '5 hr', with no units longer than hours
        return d3.timeFormat('%H')(dateStamp) + `${hairSpace}hr`
      })

    this.d3XAxisGroup
      .attr('transform', `translate(0, ${usableHeight})`)
      .call(xAxis)

    this.pixelsPerSlice = usableWidth / this.slicesCount

    this.d3SliceHighlight.style('width', Math.max(this.pixelsPerSlice, 1) + 'px')
    this.d3SliceHighlight.style('height', usableHeight + 'px')
    this.d3SliceHighlight.style('top', margins.top + 'px')
  }

  drawFiltering () {
    this.d3AreaPaths.classed('filtered', d => d.key.split('_')[1] === 'absent' || (this.layoutNode && this.layoutNode.id !== extractLayoutNodeId(d.key)))
  }

  draw () {
    super.draw()

    if (this.layoutNodeToApply) {
      this.layoutNode = this.layoutNodeToApply
      this.layoutNodeToApply = null
      this.drawFiltering()
    }
    if (this.widthToApply && this.widthToApply !== this.width) {
      this.drawPathsToFit(this.widthToApply)
    }
    if (!this.isInHoverBox) this.widthToApply = null
  }
}

function applyAggregateIdToNodeGroup (aggregateId, ui, nodeGroups, nodeGroup) {
  const aggregateNode = ui.dataSet.aggregateNodes.get(aggregateId)
  const layoutNode = ui.layout.findAggregateNode(aggregateNode)
  if (!nodeGroup || !nodeGroup.applyNodeIfValid(aggregateNode, layoutNode)) {
    nodeGroup = new NodeGroup(aggregateNode, layoutNode)
    nodeGroups.push(nodeGroup)
  }
  return nodeGroup
}

function extractLayoutNodeId (nodeGroupKey) {
  const rawId = nodeGroupKey.split('_')[1]
  if (rawId === 'absent') return null
  const layoutNodeId = numberiseIfNumericString(rawId)

  return layoutNodeId
}

class NodeGroup {
  constructor (aggregateNode, layoutNode = null) {
    this.typeCategory = aggregateNode.typeCategory
    this.layoutNodeId = layoutNode ? layoutNode.id : 'absent'
    this.aggregateNodes = [ aggregateNode ]

    this.key = `${this.typeCategory}_${this.layoutNodeId}`
  }

  applyNodeIfValid (aggregateNode, layoutNode = null) {
    const layoutNodeId = layoutNode ? layoutNode.id : 'absent'
    if (layoutNodeId === this.layoutNodeId && aggregateNode.typeCategory === this.typeCategory) {
      this.aggregateNodes.push(aggregateNode)
      return this
    }
    return false
  }

  combineAggregateData (newTimeSlice, oldTimeSlice) {
    const uniqueKey = uniqueObjectKey(this.key, newTimeSlice)
    this.key = uniqueKey
    newTimeSlice[uniqueKey] = this.aggregateNodes.reduce((total, aggregateNode) => total + oldTimeSlice[aggregateNode.id], 0)
  }
}

module.exports = AreaChart
