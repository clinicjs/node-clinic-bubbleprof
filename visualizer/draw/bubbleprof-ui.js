'use strict'

const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')
const EventEmitter = require('events')
const Layout = require('../layout/layout.js')
const SvgContainer = require('./svg-container.js')
const HoverBox = require('./hover-box.js')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings, appendTo, parentUI = null) {
    super()

    const defaultSettings = {
      numberFormatter: d3.format(',.0f'),
      strokePadding: 3,
      lineWidth: 1.5,
      labelMinimumSpace: 12,
      viewMode: 'fit'
    }
    this.settings = Object.assign(defaultSettings, settings)

    this.mainContainer = {}

    function getOriginalUI (parentUI) {
      return parentUI.parentUI ? getOriginalUI(parentUI.parentUI) : parentUI
    }
    this.parentUI = parentUI
    this.originalUI = parentUI ? getOriginalUI(parentUI) : this

    this.highlightedNode = null
    this.selectedNode = null

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
    const collapsed = layoutNode.collapsedNodes
    const nodesArray = collapsed ? collapsed.map(item => item.node) : [...layoutNode.node.nodes.values()]

    if (nodesArray && nodesArray.length) {
      const connection = layoutNode.inboundConnection
      const newLayout = new Layout({
        dataNodes: nodesArray,
        connection: connection || { targetNode: layoutNode.node }
      }, this.layout.settings)
      newLayout.generate({ collapseNodes: true })

      const nodeLinkSection = this.originalUI.sections.get('node-link')
      const newUI = new BubbleprofUI(['sublayout'], {}, nodeLinkSection, this)

      const sublayout = newUI.sections.get('sublayout')
      sublayout.addCollapseControl()
      const sublayoutSvg = sublayout.addContent(SvgContainer, {id: 'sublayout-svg', svgBounds: {}})
      sublayout.addContent(HoverBox, {svg: sublayoutSvg})

      sublayout.initializeElements()
      sublayout.d3Element.on('click', () => {
        newUI.deselectNode()
        window.layout = newUI.parentUI.layout
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
    this.selectedNode = layoutNode
    const dataNode = layoutNode.node
    switch (dataNode.constructor.name) {
      case 'ShortcutNode':
        const targetLayoutNode = this.parentUI.layout.layoutNodes.get(dataNode.shortcutTo.id)
        // TODO: replace with something better designed e.g. a back button for within sublayouts
        this.deselectNode()
        this.parentUI.createSubLayout(targetLayoutNode)
        break

      case 'AggregateNode':
        this.outputFrames(dataNode)
        break

      case 'ClusterNode':
        if (dataNode.nodes.size === 1) {
          this.outputFrames(dataNode.nodes.values().next().value)
        } else {
          this.createSubLayout(layoutNode)
        }
        break

      default:
        this.createSubLayout(layoutNode)
        break
    }
  }

  deselectNode () {
    this.sections.get('sublayout').d3Element.remove()
    this.originalUI.emit('outputFrames', null)
  }

  highlightNode (layoutNode = null) {
    this.highlightedNode = layoutNode
    this.emit('hover', layoutNode)
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
    d3Body.attr('data-view-mode', this.settings.viewMode)

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
    window.layout = layout
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
