'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')
const { validateKey } = require('../validation.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, Object.assign({
      type: 'node-link'
    }, contentProperties))
    if (!this.contentProperties.svg) throw new Error('HoverBox requires contentProperties.svg to be defined')
    validateKey(this.contentProperties.type, ['node-link', 'tool-tip'])

    this.isHidden = true
  }

  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('hover-box', true)
    this.d3Element.classed('hidden', true)

    this.d3VerticalArrow = this.d3ContentWrapper.append('div')
      .classed('vertical-arrow', true)

    this.d3TitleBlock = this.d3ContentWrapper.append('div')
      .classed('block', true)
      .classed('title-block', true)

    if (this.contentProperties.type === 'node-link') {
      this.nodeLinkElements()
      return
    }
  }

  nodeLinkElements () {
    this.d3Title = this.d3TitleBlock.append('h2')
    this.d3ClickMessage = this.d3TitleBlock.append('a')
      .classed('click-message', true)

    this.d3TimeBlock = this.d3ContentWrapper.append('div')
      .classed('block', true)
      .classed('time-block', true)

    this.d3BetweenTime = this.d3TimeBlock.append('p')
    this.d3WithinTime = this.d3TimeBlock.append('p')

    this.ui.on('hover', layoutNode => {
      if (layoutNode) this.layoutNode = layoutNode
      this.changeVisibility(!!layoutNode)
    })
  }

  nodeLinkPosition (nodePosition) {
    // The SVG element can scale like a responsive image. The HTML hover box doesn't.
    // So, the exact pixel position of the hover box depends on the SVG's current width.
    const svg = this.contentProperties.svg
    const svgContainerBounds = svg.d3Element.node().getBoundingClientRect()
    const responsiveScaleFactor = svgContainerBounds.width / svg.svgBounds.width

    const top = nodePosition.y * responsiveScaleFactor
    const left = nodePosition.x * responsiveScaleFactor
    this.position(top, left, svgContainerBounds)
  }

  positionSidewards (top, left, svgContainerBounds, hoverBounds) {
    const horizontalFlip = left + hoverBounds.width > window.innerWidth

    this.d3Element.style('top', top + 'px')
    this.d3Element.style('left', (horizontalFlip ? left - hoverBounds.width : left) + 'px')

    this.d3Element.classed('off-bottom', top + hoverBounds.height > svgContainerBounds.height)
    this.d3Element.classed('horizontal-flip', horizontalFlip)
    this.d3Element.classed('use-vertical-arrow', false)
  }

  position (top, left, svgContainerBounds) {
    const hoverBounds = this.d3Element.node().getBoundingClientRect()

    const verticalArrowPadding = 12
    const initialTop = top + verticalArrowPadding
    const initialLeft = left - verticalArrowPadding

    let arrowOffset = verticalArrowPadding
    let adjustedLeft = initialLeft - verticalArrowPadding
    const overflowX = initialLeft + hoverBounds.width - svgContainerBounds.width
    if (overflowX > 0) {
      adjustedLeft -= overflowX
      arrowOffset = overflowX
    }

    let verticalFlip = false
    let adjustedTop = initialTop
    const overflowY = initialTop + hoverBounds.height - svgContainerBounds.height
    if (overflowY > 0) {
      const titleBlockHeight = this.d3TitleBlock.node().getBoundingClientRect().height
      adjustedTop -= titleBlockHeight + verticalArrowPadding * 2
      verticalFlip = true
    }

    // On short windows with no space above or below
    if (adjustedTop < 0) {
      this.positionSidewards(top, left, svgContainerBounds, hoverBounds)
      return
    }

    this.d3Element.style('top', adjustedTop + 'px')
    this.d3Element.style('left', adjustedLeft + 'px')
    this.d3VerticalArrow.style('left', arrowOffset + 'px')

    this.d3Element.classed('off-bottom', verticalFlip)
    this.d3Element.classed('use-vertical-arrow', true)
    this.d3Element.classed('horizontal-flip', false)
  }

  changeVisibility (show) {
    this.isHidden = !show
    this.draw()
  }

  draw () {
    super.draw()

    if (this.contentProperties.type === 'node-link' && this.layoutNode) {
      this.nodeLinkDraw(this.layoutNode)
      return
    }

    // Mouseover on the hover box itself causes mouseout of the element that showed the hover box
    // Re-show hover box so mouse/trackpad users can interact with hover content e.g. select text
    // Use mouseenter / mouseleave as mouseover / mouseout re-trigger on mouseover child elements
    this.d3Element.on('mouseenter', () => {
      if (this.isHidden) this.changeVisibility(true)
    })
    this.d3Element.on('mouseleave', () => {
      this.changeVisibility(false)
    })
  }

  nodeLinkDraw (layoutNode) {
    // See comment on equivalent logic in draw ()
    this.d3Element.on('mouseenter', () => {
      if (this.isHidden) this.ui.highlightNode(this.layoutNode)
    })
    this.d3Element.on('mouseleave', () => {
      this.ui.highlightNode(null)
    })

    // Ensure off-bottom class is not applied before calculating if it's needed
    this.d3Element.classed('off-bottom', false)

    this.nodeLinkPosition(layoutNode.position)

    const nodeType = layoutNode.node.constructor.name
    const dataNode = nodeType === 'ShortcutNode' ? layoutNode.node.shortcutTo : layoutNode.node

    this.d3Title.text(dataNode.name)

    this.d3BetweenTime.html(`<strong>${this.ui.formatNumber(dataNode.getBetweenTime())}\u2009ms</strong> aggregated delay from the previous bubble.`)
    this.d3WithinTime.html(`<strong>${this.ui.formatNumber(dataNode.getWithinTime())}\u2009ms</strong> aggregated delay within this bubble.`)

    // If a clusterNode only contains one aggregate, no point clicking down into it, just give us the frames
    const isIgnorableCluster = nodeType === 'ClusterNode' && layoutNode.node.nodes.size === 1
    const clickableDataNode = isIgnorableCluster ? layoutNode.node.nodes.values().next().value : layoutNode.node
    const clickableNodeType = clickableDataNode.constructor.name

    switch (clickableNodeType) {
      case 'AggregateNode':
        this.d3ClickMessage.text('Click to display stack trace')
        this.d3Element.attr('name', 'aggregate-node')
        break
      case 'ShortcutNode':
        this.d3ClickMessage.text(`Click to navigate to "${dataNode.name}"`)
        this.d3Element.attr('name', 'shortcut-node')
        break
      case 'ArtificialNode':
      case 'ClusterNode':
        const nodesCount = nodeType === 'ClusterNode' ? dataNode.nodes.size : layoutNode.collapsedNodes.length
        this.d3ClickMessage.text(`Click to expand ${nodesCount} grouped items`)
        this.d3Element.attr('name', 'cluster-node')
        break
    }
    const clickHandler = () => {
      d3.event.stopPropagation()
      this.ui.highlightNode(null)
      this.ui.selectNode(layoutNode)
    }
    this.d3TitleBlock.on('click', clickHandler)
    this.d3VerticalArrow.on('click', clickHandler)
  }
}

module.exports = HoverBox
