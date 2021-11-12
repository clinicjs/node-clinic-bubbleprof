'use strict'

const d3 = require('./d3-subset.js')
const debounce = require('lodash/debounce')
const EventEmitter = require('events')
const htmlContentTypes = require('./html-content-types.js')
const Layout = require('../layout/layout.js')
const { validateKey } = require('../validation.js')
const spinner = require('@clinic/clinic-common/spinner')
const closeIcon = require('@clinic/clinic-common/icons/close')
const backIcon = require('@clinic/clinic-common/icons/circle-arrow-left')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings = {}, appendTo, parentUI = null) {
    super()

    const defaultSettings = {
      animationDuration: 800,
      animationEasing: d3.easeCubicInOut,
      numberFormatter: d3.format(',.0f'),
      strokePadding: 10,
      nodeLinkId: 'node-link',
      classNames: '',
      viewMode: 'fit'
    }

    this.isAnimating = false

    this.settings = Object.assign({}, defaultSettings, settings)
    this.mainContainer = {}
    this.layoutNode = null // Is assigned if this is a sublayout with .layoutNode
    this.resizeSpinner = null

    function getOriginalUI (parentUI) {
      return parentUI.parentUI ? getOriginalUI(parentUI.parentUI) : parentUI
    }
    this.parentUI = parentUI
    this.originalUI = parentUI ? getOriginalUI(parentUI) : this

    this.highlightedNode = null
    this.selectedDataNode = null
    this.name = this.parentUI && this.parentUI.selectedDataNode.name
    this.name = this.name || 'Main view'

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
      this.backBtn = nodeLinkSection.addContent(undefined, {
        hidden: true,
        htmlContent: backIcon,
        classNames: 'back-btn'
      })

      this.on('setTopmostUI', (topMostUI) => {
        this.topMostUI = topMostUI
      })
    }
  }

  /**
  * Getters and formatters
  **/

  formatNumber (num) {
    return num < 1 ? '<1' : this.settings.numberFormatter(num)
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
    if (this.dataSet && this.dataSet.settings.debugMode) settings.debugMode = true

    switch (this.settings.viewMode) {
      case 'fit':
      case 'maximised': {
        const boundingBox = this.originalUI.getNodeLinkSection().d3Element.node().getBoundingClientRect()
        settings.svgHeight = boundingBox.height
        settings.svgWidth = boundingBox.width
        settings.allowStretch = false
        break
      }
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

  /**
  * Sublayouts / UIs and transitions between them
  **/

  createSubLayout (layoutNode, animationQueue = null) {
    // Clear any highlighting
    this.highlightNode(null)

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

      const sublayoutSvg = sublayoutHtml.addContent('SvgContainer', { id: 'sublayout-svg', svgBounds: {} })
      sublayoutHtml.addContent('HoverBox', { svg: sublayoutSvg })

      uiWithinSublayout.initializeElements()

      uiWithinSublayout.initializeCloseButton(closeBtn)

      uiWithinSublayout.setData(sublayout)

      const onAnimationStep = () => {
        uiWithinSublayout.setAsTopmostUI()
      }

      if (animationQueue) {
        animationQueue.push({
          ui: uiWithinSublayout,
          isExpanding: true,
          onAnimationStep
        })
      } else {
        uiWithinSublayout.animate(true, onAnimationStep)
      }
      return uiWithinSublayout
    }
    return this
  }

  clearSublayout (animationQueue = null) {
    this.selectedDataNode = null

    // TODO: check that this frees up this and its layout for GC
    if (this.parentUI) {
      this.parentUI.selectedDataNode = null

      const onAnimationStep = () => {
        this.parentUI.setAsTopmostUI()
      }

      if (animationQueue) {
        animationQueue.push({
          ui: this,
          isExpanding: false,
          onAnimationStep
        })
      } else {
        this.animate(false, onAnimationStep)
      }
    }

    // Close the frames panel if it's open
    this.clearFrames()
    return this.parentUI
  }

  animate (isExpanding, onAnimationStep) {
    this.isAnimating = true

    this.highlightNode(null)
    this.parentUI.highlightNode(null)

    const nodeLinkSection = this.getNodeLinkSection()
    this.svgNodeDiagram.animate(isExpanding, () => {
      this.isAnimating = false
      if (!isExpanding) {
        nodeLinkSection.d3Element.remove()
        this.parentUI.svgNodeDiagram.deselectAll()
      }
      if (onAnimationStep) onAnimationStep()
    })
  }

  setAsTopmostUI () {
    // Allow user to inspect layout object
    window.layout = this.layout

    // Allow UI components to interact with whichever ui and layout is in focus
    this.originalUI.emit('setTopmostUI', this)
  }

  /**
  * Node selection and navigation
  **/

  // Selects a node visible within current layout
  selectNode (layoutNode, animationQueue) {
    this.outputFrames(null) // Make sure no frames are being output, without changing selection
    this.emit('selectNode', layoutNode)

    // The new layout generation below can be slow if >~1000 nodes, so make async
    // so that on-screen changes from emitting selectNode are shown to user first.
    return new Promise(resolve => window.requestAnimationFrame(() =>
      // Needs two chained animation frames to reliably execute _after_ DOM repaint
      window.requestAnimationFrame(() => {
        // On Firefox, animation doesn't show unless it has already started, so we need a moment's delay
        setTimeout(async () => {
          const dataNode = layoutNode.node
          const sameNode = this.selectedDataNode && this.selectedDataNode.uid === dataNode.uid

          switch (dataNode.constructor.name) {
            case 'ShortcutNode': {
              // Go up a level and start queuing animations, as shortcuts always point outside the node
              if (!animationQueue) animationQueue = new AnimationQueue('selectShortcutNode')
              const uiParent = this.clearSublayout(animationQueue)
              const targetDataNode = dataNode.targetLayoutNode ? dataNode.targetLayoutNode.node : dataNode.shortcutTo
              const targetUI = await uiParent.jumpToNode(targetDataNode, animationQueue)
              resolve(targetUI)
              break
            }

            case 'AggregateNode': {
              this.selectedDataNode = dataNode
              const selectAggregate = this.getAggregateNodeSelector(dataNode, layoutNode)
              if (animationQueue) {
                animationQueue.on('complete', selectAggregate)
              } else {
                selectAggregate()
              }
              resolve(this)
              break
            }

            case 'ClusterNode': {
              if (dataNode.nodes.size === 1) {
                // If there's only one aggregateNode, just select it
                this.selectedDataNode = dataNode.nodes.values().next().value
                const selectAggregate = this.getAggregateNodeSelector(this.selectedDataNode, layoutNode)
                if (animationQueue) {
                  animationQueue.on('complete', selectAggregate)
                } else {
                  selectAggregate()
                }
                resolve(this)
              } else {
                this.selectedDataNode = dataNode
                resolve(sameNode ? this : this.createSubLayout(layoutNode, animationQueue))
              }
              break
            }

            case 'ArtificialNode': {
              this.selectedDataNode = dataNode
              const uiWithinCollapsedNode = sameNode ? this : this.createSubLayout(layoutNode, animationQueue)
              resolve(uiWithinCollapsedNode)
              break
            }
          }
          this.emit('selectNodeComplete')
        }, 10)
      })
    ))
  }

  getAggregateNodeSelector (dataNode, layoutNode) {
    const thisUI = this
    return () => {
      thisUI.outputFrames(dataNode, layoutNode)
    }
  }

  // Selects a node that may or may not be collapsed
  async jumpToNode (dataNode, animationQueue = new AnimationQueue('jumpToNode')) {
    if (this.layoutNode && this.layoutNode.node.uid === dataNode.uid) {
      animationQueue.execute()
      return this
    }
    if (dataNode.clusterNode) {
      return this.jumpToAggregateNode(dataNode, animationQueue)
    }
    this.highlightNode(null)
    const layoutNode = this.layout.findDataNode(dataNode)
    // If we can't find the node in this sublayout, step up one level and try again
    if (!layoutNode) {
      this.clearSublayout(animationQueue)
      const targetUI = await this.parentUI.jumpToNode(dataNode, animationQueue)
      return targetUI
    }

    if (layoutNode.node.uid === dataNode.uid) {
      const uiInsideNode = await this.selectNode(layoutNode, animationQueue)
      animationQueue.execute()
      return uiInsideNode
    } else {
      // dataNode is inside one or more levels of collapsedNode - recurse
      const uiWithinCollapsedNode = await this.selectNode(layoutNode, animationQueue)
      const deepNestedUI = await uiWithinCollapsedNode.jumpToNode(dataNode, animationQueue)
      return deepNestedUI
    }
  }

  // Should not be called directly, only via jumpToNode
  async jumpToAggregateNode (aggregateNode, animationQueue) {
    this.highlightNode(null)
    const nodeId = aggregateNode.id
    const layoutNodes = this.layout.layoutNodes
    const layoutNodeInView = layoutNodes.get(nodeId)
    if (layoutNodeInView && layoutNodeInView.node.uid === aggregateNode.uid) {
      const uiInsideNode = await this.selectNode(layoutNodeInView)
      animationQueue.execute()
      return uiInsideNode
    }

    const uiWithinClusterNode = await this.jumpToNode(aggregateNode.clusterNode, animationQueue)
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
      currentUI = await currentUI.selectNode(layoutNode, animationQueue)
      if (layoutNode.node.uid === aggregateNode.uid) {
        animationQueue.execute()
        return currentUI
      }
    }
  }

  queueAnimation (name, callback) {
    const ui = this.originalUI

    const executeAnimation = () => {
      ui.currentAnimationQueue = new AnimationQueue(name)
      ui.currentAnimationQueue.next = () => {
        ui.currentAnimationQueue = null
      }
      callback(ui.currentAnimationQueue)
    }

    if (ui.currentAnimationQueue) {
      ui.currentAnimationQueue.next = executeAnimation
    } else {
      executeAnimation()
    }
  }

  setupHistory () {
    // Mark the current history entry (on page load) as the initial one.
    // There is a `window.history.length` property, but it includes the entries
    // _before_ the current page (eg. the github issue that linked to this
    // visualization) so we can't use it here.
    const hash = window.location.hash || ''
    window.history.replaceState({
      initial: true,
      hash: hash.slice(1)
    }, null, hash)

    this.on('navigation', ({ to, silent }) => {
      // Only update history if this navigation was not caused by history.
      if (!silent) {
        this.pushHistory(to.getHash())
      }

      this.backBtn.isHidden = !this.hasHistoryEntries()
      this.backBtn.draw()
    })

    window.addEventListener('popstate', (event) => {
      const hash = event.state ? event.state.hash : ''
      if (this.topMostUI) {
        // Close stack frames when moving away from their node.
        if (this.topMostUI.selectedDataNode) {
          this.topMostUI.clearFrames()
        }
      }

      // Prepare the jump we need to make.
      this.queueAnimation('history', (animationQueue) => {
        if (hash) {
          this.topMostUI.jumpToHash(hash, animationQueue)
        } else {
          // If we don't have a hash, we're navigating to the original UI.
          const targetUI = this.topMostUI.traverseUp(null, {
            silent: true,
            animationQueue
          })
          if (targetUI === this) {
            // Didn't queue any animations, just execute so 'complete' is emitted
            animationQueue.execute()
          }
        }
      })
    })
  }

  hasHistoryEntries () {
    return window.history.state && !window.history.state.initial
  }

  pushHistory (hash) {
    window.history.pushState({ hash, initial: false }, null, `#${hash || ''}`)
  }

  generateCollapsedNodeHash (uiWithinCollapsedNode) {
    let hashString = uiWithinCollapsedNode.layoutNode.id
    const appendParentNode = (parentUI) => {
      if (parentUI.layoutNode) {
        const dataNode = parentUI.layoutNode.node
        switch (dataNode.constructor.name) {
          case 'ClusterNode':
            hashString += '-c' + dataNode.clusterId
            break
          case 'ArtificialNode':
            hashString += `-${parentUI.layoutNode.id}`
            appendParentNode(parentUI.parentUI)
            break
        }
      }
    }
    appendParentNode(uiWithinCollapsedNode.parentUI)
    return hashString
  }

  getHash () {
    if (!this.layoutNode) {
      return null
    }

    const dataNode = this.layoutNode.node
    switch (dataNode.constructor.name) {
      case 'ClusterNode':
        return `c${dataNode.clusterId}`
      case 'AggregateNode':
        return `a${dataNode.aggregateId}`
      case 'ArtificialNode':
        return this.generateCollapsedNodeHash(this)
    }
    return null
  }

  async jumpToCollapsedNodeHash (hash, animationQueue = new AnimationQueue('jumpToCollapsedNodeHash')) {
    const nodeIds = hash.slice(1).split('-')
    let targetUI = this

    // If we have any cluster nodes, we jump to that below first, and then drill
    // into that node for collapsed nodes.
    // But if all the nodes in the path are collapsed nodes, we start searching
    // from the original UI. This is because collapsed nodes are only known
    // in their parent layout, not globally (like cluster nodes).
    if (nodeIds[nodeIds.length - 1].charAt(0) === 'x') {
      while (targetUI.parentUI) {
        targetUI = targetUI.clearSublayout(animationQueue)
      }
    }

    for (let i = nodeIds.length - 1; i >= 0; i--) {
      const nodeId = nodeIds[i]
      if (nodeId.charAt(0) === 'x') {
        const layoutNode = targetUI.layout.layoutNodes.get(nodeId)
        targetUI = await targetUI.selectNode(layoutNode, animationQueue)
      } else {
        const clusterId = parseInt(nodeId.slice(1))
        const clusterNode = this.dataSet.clusterNodes.get(clusterId)
        targetUI = await targetUI.jumpToNode(clusterNode, animationQueue)
      }
    }

    animationQueue.execute()
    this.originalUI.emit('navigation', { from: this, to: targetUI, silent: true })
  }

  async jumpToHash (hash, animationQueue) {
    const id = parseInt(hash.slice(1))
    switch (hash.charAt(0)) {
      case 'a': {
        const aggregateNode = this.dataSet.aggregateNodes.get(id)
        const uiWithinAggregate = await this.jumpToNode(aggregateNode, animationQueue)
        this.originalUI.emit('navigation', { from: this, to: uiWithinAggregate, silent: true })
        break
      }
      case 'c': {
        const clusterNode = this.dataSet.clusterNodes.get(id)
        const uiWithinCluster = await this.jumpToNode(clusterNode, animationQueue)
        this.originalUI.emit('navigation', { from: this, to: uiWithinCluster, silent: true })
        break
      }
      case 'x':
        this.jumpToCollapsedNodeHash(window.location.hash, animationQueue)
        break
    }
  }

  /**
  * Other interactions
  **/

  highlightNode (layoutNode = null, dataNode = null) {
    if (this.isAnimating && layoutNode) return
    this.highlightedNode = layoutNode
    this.highlightedDataNode = dataNode
    this.emit('hover', layoutNode)
  }

  highlightColour (targetType, label = null) {
    const eventName = targetType === 'party' ? 'highlightParty' : 'highlightType'
    this.originalUI.emit(eventName, label)
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

  /**
  * Initialization and draw
  **/

  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements () {
    const d3Body = d3.select('body')
    const d3Main = d3.select('main')
    d3Body.classed('initialized', true)
    d3Body.attr('data-view-mode', this.settings.viewMode)

    this.mainContainer.d3Element = d3Main.size()
      ? d3Main
      : d3Body.append('main').attr('id', 'bubbleprof-main')
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
    if (!this.layoutNode) {
      this.resizeSpinner = spinner.attachTo(nodeLinkSection.d3Element.node())
    }

    const onWindowResize = debounce(() => {
      this.redrawLayout()

      if (this.resizeSpinner) {
        this.resizeSpinner.hide()
      }
    }, debounceTime)

    window.addEventListener('resize', () => {
      if (this.resizeSpinner) {
        this.resizeSpinner.show('Redrawing...')
      }

      onWindowResize()
    })

    if (this.originalUI === this) {
      this.initializeBackButton()
    }
  }

  // Close button returns to the originalUI
  initializeCloseButton (closeBtn) {
    closeBtn.d3Element
      .html(closeIcon)
      .on('click', () => {
        this.queueAnimation('close', (animationQueue) => {
          this.traverseUp(null, { animationQueue })
        })
      })
  }

  // Clear sublayouts until the topmost layout is `targetUI`, or the original UI if no target is given.
  // Pass `{ silent: true }` to avoid updating the hash when this is called in response to a history update.
  traverseUp (targetUI = null, options = {}) {
    const {
      silent = false,
      animationQueue = new AnimationQueue('traverseUp')
    } = options

    let currentUI = this
    while (currentUI !== targetUI && currentUI.parentUI) {
      currentUI = currentUI.clearSublayout(animationQueue)
    }
    if (currentUI !== this) {
      this.originalUI.emit('navigation', { from: this, to: currentUI, silent })
      animationQueue.execute()
    }
    return currentUI
  }

  // Back button goes back in user navigation one step at a time
  // This does not record opening frames
  // This does record pressing ESC and close button
  initializeBackButton () {
    this.backBtn.d3Element
      .classed('hidden', true)
      .on('click', () => this.stepBack())

    document.addEventListener('keydown', (e) => {
      if (e.keyCode === 8 && e.target.nodeName.toLowerCase() !== 'input') {
        // Backspace button
        this.stepBack()
      }
    })
  }

  stepBack () {
    if (!this.hasHistoryEntries()) {
      return
    }
    window.history.back()
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

  complete () {
    this.setAsTopmostUI()
    this.emit('complete')

    if (window.location.hash) {
      setTimeout(() => {
        this.queueAnimation('initial', (animationQueue) => {
          this.jumpToHash(window.location.hash.slice(1), animationQueue)
        })
      })
    }

    this.setupHistory()
  }

  // For all UI item instances, keep updates and changes to DOM elements in draw() method
  // so that browser paint etc can happen around the same time, minimising reflows
  draw () {
    // TODO: try replacing with .emit('draw')
    for (const section of this.sections.values()) {
      section.draw()
    }
  }

  redrawLayout () {
    const newLayout = new Layout(this.layout.initialInput, this.getSettingsForLayout())
    newLayout.generate()
    this.setData(newLayout)
  }
}

class AnimationQueue extends EventEmitter {
  // The createdIn argument is helpful when debugging animations. Best to pass it!
  constructor (createdIn) {
    super()

    this.queue = []
    this.index = 0
    this.isExecuting = false
    this.createdIn = createdIn
  }

  // Used by BubbleprofUI to chain animations.
  // This will be replaced by a function that kicks off the next animation queue.
  next () {}

  push (animation) {
    this.queue.push(animation)
    if (this.isExecuting) this.markUIPending(animation)
  }

  markUIPending (item) {
    item.ui.getNodeLinkSection().d3Element.classed('pending-animation', true)
  }

  execute () {
    if (this.isExecuting) {
      return
    }
    this.executeNext()
  }

  hasMoreAnimations () {
    return this.queue.length > this.index
  }

  executeNext () {
    if (!this.hasMoreAnimations()) {
      this.isExecuting = false
      this.emit('complete')
      this.next()
      return
    }

    this.isExecuting = true
    if (this.index === 0) {
      this.queue.forEach(item => this.markUIPending(item))
    }

    const {
      ui,
      isExpanding,
      onAnimationStep
    } = this.queue[this.index]

    this.index++

    ui.getNodeLinkSection().d3Element.classed('pending-animation', false)
    ui.animate(isExpanding, () => {
      if (onAnimationStep) onAnimationStep()
      this.executeNext()
    })
  }
}

module.exports = BubbleprofUI
