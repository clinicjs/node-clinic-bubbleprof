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

      return topMostUI.jumpToNode(lastLayoutNode.node)
    }
  }

  formatNumber (num) {
    return num < 1 ? '<1' : this.settings.numberFormatter(num)
  }

  // Selects a node visible within current layout
  selectNode (layoutNode) {
    const dataNode = layoutNode.node
    const sameNode = this.selectedDataNode && this.selectedDataNode.uid === dataNode.uid

    switch (dataNode.constructor.name) {
      case 'ShortcutNode':
        const uiParent = this.clearSublayout() // Go up a level as shortcuts always point outside the node
        const targetDataNode = dataNode.targetLayoutNode ? dataNode.targetLayoutNode.node : dataNode.shortcutTo
        return uiParent.jumpToNode(targetDataNode)

      case 'AggregateNode':
        this.selectedDataNode = dataNode
        this.outputFrames(dataNode, layoutNode)
        window.location.hash = 'a' + dataNode.aggregateId
        return this

      case 'ClusterNode':
        window.location.hash = 'c' + dataNode.clusterId
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
        const uiWithinCollapsedNode = sameNode ? this : this.createSubLayout(layoutNode)
        window.location.hash = this.generateCollapsedNodeHash(uiWithinCollapsedNode)
        return uiWithinCollapsedNode
    }
  }

  generateCollapsedNodeHash (uiWithinCollapsedNode) {
    let hash = `l${uiWithinCollapsedNode.layoutNode.id}|`
    const appendParentNode = (parentUI) => {
      if (!parentUI.layoutNode) {
        hash += 'm'
      } else {
        const dataNode = parentUI.layoutNode.node
        switch (dataNode.constructor.name) {
          case 'ClusterNode':
            hash += 'c' + dataNode.clusterId
            break
          case 'ArtificialNode':
            hash += `l${parentUI.layoutNode.id}|`
            appendParentNode(parentUI.parentUI)
            break
        }
      }
    }
    appendParentNode(uiWithinCollapsedNode.parentUI)
    return hash
  }

  parseCollapsedNodeHash () {
    const nodeIds = window.location.hash.slice(1).split('|')
    const lastNodeId = nodeIds.pop()
    let targetUI
    if (lastNodeId === 'm') {
      targetUI = this
    } else {
      const clusterId = parseInt(lastNodeId.slice(1))
      const clusterNode = this.dataSet.clusterNodes.get(clusterId)
      targetUI = this.jumpToNode(clusterNode)
    }

    for (var i = nodeIds.length - 1; i >= 0; i--) {
      const layoutNodeId = nodeIds[i].slice(1)
      const layoutNode = targetUI.layout.layoutNodes.get(layoutNodeId)
      targetUI = targetUI.selectNode(layoutNode)
    }
    this.emit('navigation', { from: this, to: targetUI })
  }

  clearSublayout () {
    this.selectedDataNode = null

    // TODO: check that this frees up this and its layout for GC
    if (this.parentUI) {
      this.getNodeLinkSection().d3Element.remove()
      this.parentUI.selectedDataNode = null
      this.parentUI.setAsTopmostUI()
      if (this.parentUI.layoutNode) {
        const dataNode = this.parentUI.layoutNode.node
        switch (dataNode.constructor.name) {
          case 'ClusterNode':
            window.location.hash = 'c' + dataNode.clusterId
            break
          case 'AggregateNode':
            window.location.hash = 'a' + dataNode.aggregateId
            break
          case 'ArtificialNode':
            window.location.hash = this.generateCollapsedNodeHash(this.parentUI)
            break
        }
      } else {
        window.location.hash = ''
      }
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
    if (this.layoutNode && this.layoutNode.node.uid === dataNode.uid) {
      return this
    }
    if (dataNode.clusterNode) {
      return this.jumpToAggregateNode(dataNode)
    }
    this.highlightNode(null)
    const layoutNode = this.layout.findDataNode(dataNode)
    // If we can't find the node in this sublayout, step up one level and try again
    if (!layoutNode) {
      this.clearSublayout()
      return this.parentUI.jumpToNode(dataNode)
    }

    if (layoutNode.node.uid === dataNode.uid) {
      return this.selectNode(layoutNode)
    } else {
      // dataNode is inside one or more levels of collapsedNode - recurse
      const uiWithinCollapsedNode = this.selectNode(layoutNode)
      return uiWithinCollapsedNode.jumpToNode(dataNode)
    }
  }

  // Should not be called directly, only via jumpToNode
  jumpToAggregateNode (aggregateNode) {
    this.highlightNode(null)
    const nodeId = aggregateNode.id
    const layoutNodes = this.layout.layoutNodes
    const layoutNodeInView = layoutNodes.get(nodeId)
    if (layoutNodeInView && layoutNodeInView.node.uid === aggregateNode.uid) {
      return this.selectNode(layoutNodeInView)
    }

    const uiWithinClusterNode = this.jumpToNode(aggregateNode.clusterNode)
    if (aggregateNode.clusterNode.nodes.size === 1) {
      return uiWithinClusterNode
    }
    let currentUI = uiWithinClusterNode
    while (currentUI) {
      const layoutNode = currentUI.layout.findDataNode(aggregateNode)
      if (!layoutNode) {
        const context = [...currentUI.layout.layoutNodes.values()].map(layoutNode => layoutNode.id).join(';')
        const viewUID = `${currentUI.layoutNode && currentUI.layoutNode.node.uid} "${currentUI.name}"`
        const clusterUID = aggregateNode.clusterNode && aggregateNode.clusterNode.uid
        throw new Error(`Could not find aggregate ${aggregateNode.uid} from cluster ${clusterUID} in view ${viewUID} with nodes ${context}`)
      }
      currentUI = currentUI.selectNode(layoutNode)
      if (layoutNode.node.uid === aggregateNode.uid) {
        return currentUI
      }
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
        switch (window.location.hash.charAt(1)) {
          case 'a':
            const aggregateNode = this.dataSet.aggregateNodes.get(id)
            const uiWithinAggregate = this.jumpToNode(aggregateNode)
            this.emit('navigation', { from: this, to: uiWithinAggregate })
            break
          case 'c':
            const clusterNode = this.dataSet.clusterNodes.get(id)
            const uiWithinCluster = this.jumpToNode(clusterNode)
            this.emit('navigation', { from: this, to: uiWithinCluster })
            break
          case 'l':
            this.parseCollapsedNodeHash(window.location.hash)
            break
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
