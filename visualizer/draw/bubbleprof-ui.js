'use strict'

const d3 = require('./d3-subset.js')
const debounce = require('lodash/debounce')
const EventEmitter = require('events')
const htmlContentTypes = require('./html-content-types.js')
const Layout = require('../layout/layout.js')
const { validateKey } = require('../validation.js')

const history = []

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings = {}, appendTo, parentUI = null) {
    super()

    const defaultSettings = {
      numberFormatter: d3.format(',.0f'),
      strokePadding: 10,
      nodeLinkId: 'node-link',
      classNames: '',
      viewMode: 'fit'
    }

    this.settings = Object.assign({}, defaultSettings, settings)
    this.mainContainer = {}
    this.layoutNode = null // Is assigned if this is a sublayout with .layoutNode

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
      this.sections.set(sectionName, new htmlContentTypes.HtmlContent(appendTo, {
        htmlElementType: 'section',
        id: sectionName,
        classNames: this.settings.classNames
      }, this))
    }

    if (this.originalUI === this) {
      const nodeLinkSection = this.getNodeLinkSection()
      this.backBtn = nodeLinkSection.addContent(undefined, { classNames: 'back-btn' })
      history.push(this)
      this.on('navigation', ({ to }) => {
        history.push(to)
        this.backBtn.d3Element.classed('hidden', history.length < 2)
      })
    }
  }

  getContentClass (className) {
    validateKey(className, Object.keys(htmlContentTypes))
    return htmlContentTypes[className]
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
    const sublayout = this.layout.createSubLayout(layoutNode, this.getSettingsForLayout())
    if (sublayout) {
      sublayout.generate()
      const nodeLinkSection = this.originalUI.getNodeLinkSection()

      const nodeLinkId = 'node-link-' + layoutNode.id
      const uiWithinSublayout = new BubbleprofUI([nodeLinkId], {
        nodeLinkId,
        classNames: 'sublayout'
      }, nodeLinkSection, this)
      uiWithinSublayout.layoutNode = layoutNode

      const sublayoutHtml = uiWithinSublayout.sections.get(nodeLinkId)
      sublayoutHtml.addCollapseControl()
      const closeBtn = sublayoutHtml.addContent(undefined, { classNames: 'close-btn' })

      const sublayoutSvg = sublayoutHtml.addContent('SvgContainer', {id: 'sublayout-svg', svgBounds: {}})
      sublayoutHtml.addContent('HoverBox', {svg: sublayoutSvg})

      uiWithinSublayout.initializeElements()

      uiWithinSublayout.initializeCloseButton(closeBtn)

      uiWithinSublayout.setData(sublayout)
      uiWithinSublayout.setAsTopmostUI()
      return uiWithinSublayout
    }
    return this
  }

  // Close button returns to the originalUI
  initializeCloseButton (closeBtn) {
    closeBtn.d3Element
      .property('textContent', '×')
      .on('click', () => {
        let targetUI = this
        while (targetUI.layoutNode) {
          targetUI = targetUI.clearSublayout()
        }
        if (targetUI !== this.ui) {
          this.originalUI.emit('navigation', { from: this, to: targetUI })
        }
      })
  }

  // Back button goes back in user navigation one step at a time
  // This does not record opening frames
  // This does record pressing ESC and close button
  initializeBackButton () {
    const { backBtn, originalUI } = this
    backBtn.d3Element
      .classed('hidden', true)
      .on('click', stepBack)

    document.addEventListener('keydown', (e) => {
      if (e.keyCode === 8 && e.target.nodeName.toLowerCase() !== 'input') {
        // Backspace button
        stepBack()
      }
    })

    let topMostUI = this
    this.on('setTopmostUI', (newTopmostUI) => {
      topMostUI = newTopmostUI
    })

    function stepBack () {
      if (history.length < 2) {
        return
      }
      if (topMostUI.selectedDataNode) {
        return topMostUI.clearFrames()
      }
      history.pop()
      const lastUI = history[history.length - 1]
      const lastLayoutNode = lastUI.layoutNode
      backBtn.d3Element.classed('hidden', history.length < 2)

      if (lastUI === originalUI) {
        while (topMostUI.layoutNode) {
          topMostUI = topMostUI.clearSublayout()
        }
        return
      }

      // TODO: investigate why this is necessary
      // i.e. it seems like jumpToNode/findDataNode cannot handle case where it has to inspect both .collapsedNodes and .nodes to find the target
      // e.g. jump from aggregate clump in one branch to aggregate clump in another branch
      if (lastLayoutNode.node.constructor.name === 'ArtificialNode') {
        const pathDown = []
        // Find ancestor ui with non-artificial DataNode
        let ancestorUI = lastUI
        while (ancestorUI) {
          if (!ancestorUI.layoutNode || ancestorUI.layoutNode.node.constructor.name !== 'ArtificialNode') {
            break
          }
          pathDown.unshift(ancestorUI)
          ancestorUI = ancestorUI.parentUI
        }
        if (ancestorUI === originalUI) {
          while (topMostUI.layoutNode) {
            topMostUI = topMostUI.clearSublayout()
          }
        } else {
          topMostUI = topMostUI.jumpToNode(ancestorUI.layoutNode.node)
        }
        for (const stepDownUI of pathDown) {
          topMostUI = topMostUI.selectNode(stepDownUI.layoutNode)
        }
      } else {
        topMostUI.jumpToNode(lastLayoutNode.node)
      }
    }
  }

  formatNumber (num) {
    return num < 1 ? '<1' : this.settings.numberFormatter(num)
  }

  // Selects a node visible within current layout
  selectNode (layoutNode) {
    const dataNode = layoutNode.node
    const sameNode = this.selectedDataNode === dataNode

    switch (dataNode.constructor.name) {
      case 'ShortcutNode':
        // Handle merged shortcut node
        if (dataNode.targetLayoutNode) {
          return this.selectNode(dataNode.targetLayoutNode)
        }

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

    return this.parentUI
  }

  highlightNode (layoutNode = null, dataNode = null) {
    this.highlightedNode = layoutNode
    this.highlightedDataNode = dataNode
    this.emit('hover', layoutNode)
  }

  // Selects a node that may or may not be collapsed
  jumpToNode (dataNode) {
    this.highlightNode(null)
    const layoutNode = this.layout.findDataNode(dataNode)
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
      const collapsedLayoutNode = uiWithinClusterNode.layout.findCollapsedNode(aggregateNode)
      const uiWithinCollapsedNode = uiWithinClusterNode.selectNode(collapsedLayoutNode)
      return uiWithinCollapsedNode.jumpToNode(aggregateNode)
    }
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
    const d3Main = d3.select('main')
    d3Body.classed('initialized', true)
    d3Body.attr('data-view-mode', this.settings.viewMode)

    this.mainContainer.d3Element = d3Main.size() ? d3Main : d3Body.append('main')
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

    if (this.originalUI === this) {
      this.initializeBackButton()
    }
  }

  setData (layout, dataSet) {
    if (layout === this.layout) return
    const initialize = !this.layout

    this.dataSet = dataSet || this.dataSet || this.parentUI.dataSet
    this.layout = layout
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

  complete () {
    this.setAsTopmostUI()
    this.emit('complete')

    if (window.location.hash) {
      setTimeout(() => {
        const id = parseInt(window.location.hash.slice(2))
        if (window.location.hash.charAt(1) === 'a') {
          const aggregateNode = this.dataSet.aggregateNodes.get(id)
          this.jumpToAggregateNode(aggregateNode)
        } else if (window.location.hash.charAt(1) === 'c') {
          const clusterNode = this.dataSet.clusterNodes.get(id)
          this.jumpToNode(clusterNode)
        }
      })
    }
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
