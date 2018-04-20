'use strict'

const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')
const EventEmitter = require('events')
const Layout = require('../layout/layout.js')
const SvgContainer = require('./svg-container.js')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings, appendTo, parentUI = null) {
    super()

    const defaultSettings = {
      numberFormatter: d3.format(',.0f'),
      strokePadding: 4,
      lineWidth: 2,
      labelMinimumSpace: 14
    }
    this.settings = Object.assign(defaultSettings, settings)

    this.mainContainer = {}

    function getOriginalUI (parentUI) {
      return parentUI.parentUI ? getOriginalUI(parentUI.parentUI) : parentUI
    }
    this.parentUI = parentUI
    this.originalUI = parentUI ? getOriginalUI(parentUI) : this

    // Main divisions of the page
    this.sections = new Map()

    for (const sectionName of sections) {
      this.sections.set(sectionName, new HtmlContent(appendTo, {
        htmlElementType: 'section',
        id: sectionName
      }, this))
    }
  }

  createSubLayout (layoutNode) {
    const node = layoutNode.node
    if (node.nodes && node.nodes.size) {
      const newLayout = new Layout([...node.nodes.values()], this.layout.settings)
      newLayout.prepareSublayoutNodes(layoutNode.inboundConnection)
      newLayout.generate()

      const nodeLinkSection = this.sections.get('node-link')
      const newUI = new BubbleprofUI(['sublayout'], {}, nodeLinkSection, this)

      const sublayout = newUI.sections.get('sublayout')
      sublayout.addCollapseControl()
      const sublayoutSvg = sublayout.addContent(SvgContainer, {id: 'sublayout-svg', svgBounds: {}})
      sublayout.initializeElements()
      sublayout.d3Element.on('click', () => {
        sublayout.d3Element.remove()
      })
      sublayoutSvg.addBubbles({nodeType: 'AggregateNode'})
      sublayoutSvg.addLinks({nodeType: 'AggregateNode'})
      newUI.setData(this.dataSet, newLayout)
    }
  }

  formatNumber (num) {
    return num < 1 ? '<1' : this.settings.numberFormatter(num)
  }

  selectNode (layoutNode) {
    const dataNode = layoutNode.node
    if (dataNode.linkTo) {
      const targetLayoutNode = this.parentUI.layout.layoutNodes.get(dataNode.linkTo.id)
      this.parentUI.createSubLayout(targetLayoutNode)
      // TODO: replace with something better designed e.g. a back button for within sublayouts
      this.sections.get('sublayout').d3Element.remove()
    } else if (dataNode.constructor.name === 'AggregateNode') {
      this.outputFrames(dataNode)
    } else {
      this.createSubLayout(layoutNode)
    }
  }

  outputFrames (aggregateNode) {
    this.originalUI.emit('outputFrames', aggregateNode)
  }

  truncateLabel (labelString, maxWords, maxChars) {
    const labelWords = labelString.split(' ')
    let truncatedLabel = labelString
    let addEllipsis = false

    if (labelWords.length > maxWords) {
      truncatedLabel = labelWords.slice(0, maxWords).join(' ')
      addEllipsis = true
    }

    if (truncatedLabel.length > maxChars) {
      truncatedLabel = truncatedLabel.slice(0, maxChars - 2)
      addEllipsis = true
    }

    if (addEllipsis) truncatedLabel += '…'

    return truncatedLabel
  }

  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements () {
    const d3Body = d3.select('body')
    d3Body.classed('initialized', true)

    this.mainContainer.d3Element = d3Body.append('main')
    this.mainContainer.d3ContentWrapper = this.mainContainer.d3Element

    // TODO: try replacing with .emit('initializeElements')
    for (const section of this.sections.values()) {
      section.initializeElements()
    }

    this.on('highlightType', (className) => {
      d3Body.attr('data-highlight-type', className || null)
    })

    this.on('highlightParty', (className) => {
      d3Body.attr('data-highlight-party', className || null)
    })
  }

  setData (dataSet, layout) {
    const redraw = dataSet !== this.dataSet || layout !== this.layout
    this.dataSet = dataSet
    this.layout = layout
    this.emit('setData')
    if (redraw) this.draw()
  }

  // For all UI item instances, keep updates and changes to DOM elements in draw() method
  // so that browser paint etc can happen around the same time, minimising reflows
  draw () {
    // TODO: try replacing with .emit('draw')
    for (const section of this.sections.values()) {
      section.draw()
    }
  }
}
module.exports = BubbleprofUI
