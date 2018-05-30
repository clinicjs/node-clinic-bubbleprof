'use strict'

const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')
const debounce = require('lodash/debounce')
const EventEmitter = require('events')
const Layout = require('../layout/layout.js')
const SvgContainer = require('./svg-container.js')
const HoverBox = require('./hover-box.js')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings = {}, appendTo, parentUI = null) {
    super()

    const defaultSettings = {
      numberFormatter: d3.format(',.0f'),
      strokePadding: 3,
      nodeLinkId: 'node-link',
      classNames: '',
      viewMode: 'fit'
    }

    this.settings = Object.assign({}, defaultSettings, settings)
    this.mainContainer = {}

    function getOriginalUI (parentUI) {
      return parentUI.parentUI ? getOriginalUI(parentUI.parentUI) : parentUI
    }
    this.parentUI = parentUI
    this.originalUI = parentUI ? getOriginalUI(parentUI) : this

    this.highlightedNode = null
    this.selectedDataNode = null
    this.name = this.parentUI && this.parentUI.selectedDataNode.name
    this.name = this.name || 'Main view'
    this.name = this.name.split(' ').filter(str => !str.includes('/') && !str.includes(':')).join(' ')

    // Main divisions of the page
    this.sections = new Map()

    for (const sectionName of sections) {
      this.sections.set(sectionName, new HtmlContent(appendTo, {
        htmlElementType: 'section',
        id: sectionName,
        classNames: this.settings.classNames
      }, this))
    }
  }

  getNodeLinkSection () {
    return this.sections.get(this.settings.nodeLinkId)
  }

  getSettingsForLayout () {
    const settings = {}
    switch (this.settings.viewMode) {
      case 'fit':
      case 'maximised':
        const boundingBox = this.originalUI.getNodeLinkSection().d3Element.node().getBoundingClientRect()
        settings.svgHeight = boundingBox.height
        settings.svgWidth = boundingBox.width
        settings.allowStretch = false
        break
      case 'scroll':
      default:
        settings.allowStretch = true
        break
    }

    if (this.layout) {
      settings.collapseNodes = this.layout.settings.collapseNodes
    }
    return settings
  }

  createSubLayout (layoutNode) {
    const collapsed = layoutNode.collapsedNodes
    const nodesArray = collapsed ? collapsed.map(item => item.node) : [...layoutNode.node.nodes.values()]

    if (nodesArray && nodesArray.length) {
      const connection = layoutNode.inboundConnection

      const newLayout = new Layout({
        dataNodes: nodesArray,
        connection: connection || { targetNode: layoutNode.node }
      }, this.getSettingsForLayout())
      newLayout.generate()

      const nodeLinkSection = this.originalUI.getNodeLinkSection()

      const nodeLinkId = 'node-link-' + layoutNode.id
      const uiWithinSublayout = new BubbleprofUI([nodeLinkId], {
        nodeLinkId,
        classNames: 'sublayout'
      }, nodeLinkSection, this)
      const sublayout = uiWithinSublayout.sections.get(nodeLinkId)
      sublayout.addCollapseControl()
      const closeBtn = sublayout.addContent(undefined, { classNames: 'close-btn' })

      const sublayoutSvg = sublayout.addContent(SvgContainer, {id: 'sublayout-svg', svgBounds: {}})
      sublayoutSvg.addBubbles({nodeType: 'AggregateNode'})
      sublayoutSvg.addLinks({nodeType: 'AggregateNode'})
      sublayout.addContent(HoverBox, {svg: sublayoutSvg})

      uiWithinSublayout.initializeElements()

      // Close button returns to originalUI
      let closing = false
      let topmostUI
      closeBtn.d3Element
        .property('textContent', '×')
        .on('click', () => {
          closing = true
          topmostUI.clearSublayout()
        })
      this.originalUI.on('setTopmostUI', (newTopmostUI) => {
        topmostUI = newTopmostUI
        if (closing) {
          if (topmostUI !== this.originalUI) {
            topmostUI.clearSublayout()
          } else {
            closing = false
          }
        }
      })

      uiWithinSublayout.setData(newLayout)
      return uiWithinSublayout
    }
    return this
  }

  formatNumber (num) {
    return num < 1 ? '<1' : this.settings.numberFormatter(num)
  }

  selectNode (layoutNode) {
    const dataNode = layoutNode.node
    const sameNode = this.selectedDataNode === dataNode

    switch (dataNode.constructor.name) {
      case 'ShortcutNode':
        // TODO: replace with something better designed e.g. a back button for within sublayouts
        this.clearSublayout()
        this.selectedDataNode = dataNode.shortcutTo
        const uiWithinShortcutTarget = this.jumpToNode(dataNode.shortcutTo)

        // If shortcutTarget is an aggregateNode, this will open its frames
        uiWithinShortcutTarget.clearFrames()
        return uiWithinShortcutTarget

      case 'AggregateNode':
        this.selectedDataNode = dataNode
        this.outputFrames(dataNode, layoutNode)
        return this

      case 'ClusterNode':
        if (dataNode.nodes.size === 1) {
          // If there's only one aggregateNode, just select it
          this.selectedDataNode = dataNode.nodes.values().next().value
          this.outputFrames(this.selectedDataNode, layoutNode)
          return this
        } else {
          this.selectedDataNode = dataNode
          return sameNode ? this : this.createSubLayout(layoutNode)
        }

      case 'ArtificialNode':
        this.selectedDataNode = dataNode
        return sameNode ? this : this.createSubLayout(layoutNode)
    }
  }

  clearSublayout () {
    this.selectedDataNode = null

    // TODO: check that this frees up this and its layout for GC
    if (this.parentUI) {
      this.getNodeLinkSection().d3Element.remove()
      this.parentUI.selectedDataNode = null
      this.parentUI.setAsTopmostUI()
    }

    // Close the frames panel if it's open
    this.clearFrames()
  }

  highlightNode (layoutNode = null) {
    this.highlightedNode = layoutNode
    this.emit('hover', layoutNode)
  }

  // Selects a node that may or may not be collapsed
  jumpToNode (dataNode) {
    this.highlightNode(null)
    const layoutNode = this.findDataNodeInLayout(dataNode)

    // If we can't find the node in this sublayout, step up one level and try again
    if (!layoutNode) {
      this.clearSublayout()
      return this.parentUI.jumpToNode(dataNode)
    }

    if (layoutNode.node === dataNode) {
      return this.selectNode(layoutNode)
    } else {
      // dataNode is inside one or more levels of collapsedNode - recurse
      const uiWithinCollapsedNode = this.selectNode(layoutNode)
      return uiWithinCollapsedNode.jumpToNode(dataNode)
    }
  }

  jumpToAggregateNode (aggregateNode) {
    this.highlightNode(null)
    const nodeId = aggregateNode.id
    const layoutNodes = this.layout.layoutNodes
    if (layoutNodes.has(nodeId) && layoutNodes.get(nodeId).node.constructor.name === 'AggregateNode') {
      return this.selectNode(this.layout.layoutNodes.get(nodeId))
    }

    this.clearSublayout()

    const uiWithinClusterNode = this.jumpToNode(aggregateNode.clusterNode)

    // If that clusterNode contains only this aggregateNode, it will have been automatically selected already
    if (uiWithinClusterNode.selectedDataNode === aggregateNode) return

    if (uiWithinClusterNode.layout.layoutNodes.has(nodeId)) {
      const layoutNode = uiWithinClusterNode.layout.layoutNodes.get(nodeId)
      return uiWithinClusterNode.selectNode(layoutNode)
    } else {
      const collapsedLayoutNode = uiWithinClusterNode.findCollapsedNodeInLayout(aggregateNode)
      const uiWithinCollapsedNode = uiWithinClusterNode.selectNode(collapsedLayoutNode)
      return uiWithinCollapsedNode.jumpToNode(aggregateNode)
    }
  }

  // Returns a containing layoutNode, or false if it can't be found at this level
  findDataNodeInLayout (dataNode) {
    const nodeId = dataNode.id
    const layoutNodes = this.layout.layoutNodes
    if (layoutNodes.has(nodeId) && layoutNodes.get(nodeId).node === dataNode) {
      return this.layout.layoutNodes.get(nodeId)
    } else {
      return this.findCollapsedNodeInLayout(dataNode)
    }
  }

  findCollapsedNodeInLayout (dataNode) {
    for (const layoutNode of this.layout.layoutNodes.values()) {
      if (layoutNode.collapsedNodes && layoutNode.collapsedNodes.some((subLayoutNode) => subLayoutNode.node === dataNode)) {
        return layoutNode
      }
    }
    return false
  }

  outputFrames (aggregateNode, layoutNode = null) {
    if (layoutNode) {
      this.highlightNode(layoutNode)
    }
    this.originalUI.emit('outputFrames', aggregateNode)
  }

  clearFrames () {
    this.selectedDataNode = null
    this.originalUI.emit('outputFrames', null)
  }

  collapseEvent (eventName) {
    // Called when a collapsable with a given collapseEvent name opens, to close all others
    this.emit(`collapse-${eventName}`)
  }

  redrawLayout () {
    const newLayout = new Layout(this.layout.initialInput, this.getSettingsForLayout())
    newLayout.generate()
    this.setData(newLayout)
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

    const debounceTime = 300
    const nodeLinkSection = this.getNodeLinkSection()

    const onWindowResizeBegin = debounce(() => {
      nodeLinkSection.d3Element.classed('redraw', true)

      // Use a shorter time period than the trailing debounce to prevent getting stuck
    }, debounceTime * 0.9, { leading: true })

    const onWindowResizeEnd = debounce(() => {
      this.redrawLayout()
      nodeLinkSection.d3Element.classed('redraw', false)
    }, debounceTime)

    window.addEventListener('resize', () => {
      onWindowResizeBegin()
      onWindowResizeEnd()
    })
  }

  setData (layout) {
    if (layout === this.layout) return
    const initialize = !this.layout

    this.layout = layout
    this.setAsTopmostUI()
    this.emit('setData')

    if (initialize) {
      // Copy layout settings like lineWidth
      Object.assign(this.settings, layout.settings)
      this.emit('initializeFromData')
    }
    this.emit('svgDraw')
  }

  setAsTopmostUI () {
    // Allow user to inspect layout object
    window.layout = this.layout

    // Allow UI components to interact with whichever ui and layout is in focus
    this.originalUI.emit('setTopmostUI', this)
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
