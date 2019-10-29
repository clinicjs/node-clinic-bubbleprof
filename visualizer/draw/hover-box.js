'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')
const { validateKey } = require('../validation.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, Object.assign({
      type: 'node-link',
      position: { x: 0, y: 0 },
      allowableOverflow: 0,
      fixedOrientation: null
    }, contentProperties))
    validateKey(this.contentProperties.type, ['node-link', 'tool-tip', 'static'])
    if (this.contentProperties.type === 'node-link') {
      if (!this.contentProperties.svg) throw new Error('Node-link HoverBox requires contentProperties.svg to be defined')

      this.ui.on('selectNode', layoutNode => {
        if (!layoutNode || layoutNode.node.constructor.name === 'AggregateNode' ||
          (layoutNode.node.constructor.name === 'ClusterNode' && layoutNode.node.nodes.size === 1)) {
          // Don't display busy indicator if we'll just show frames, won't be cancelled by setTopmostUI
          return
        }

        // Immediately change click message so if select is slow, it's clear something is happening
        this.d3TitleBlock.classed('is-loading', true)

        const newText = this.d3ClickMessage.text().replace('Click to expand', 'Expanding') + '...'
        this.d3ClickMessage.text(newText)
      })

      this.ui.on('selectNodeComplete', () => {
        let newText = this.d3ClickMessage.text()
        newText = newText.replace('Expanding', 'Click to expand')
        newText = newText.replace('...', '')
        this.d3ClickMessage.text(newText)
        this.d3TitleBlock.classed('is-loading', false)
      })
    }
    this.isHidden = true

    this.layoutNode = null
    this.drawnLayoutNode = null
  }

  initializeElements () {
    if (this.d3Element) return
    super.initializeElements(true) // Tells super not to add .htmlContent to default position

    this.d3Element.classed('hover-box', true)
    this.d3Element.classed('hidden', true)

    this.d3VerticalArrow = this.d3ContentWrapper.append('div')
      .classed('vertical-arrow', true)

    this.d3TitleBlock = this.d3ContentWrapper.append('div')
      .classed('block', true)
      .classed('title-block', true)
      .html(this.contentProperties.htmlContent || '')

    if (this.contentProperties.type === 'node-link') {
      this.nodeLinkElements()
    }
  }

  nodeLinkElements () {
    this.d3Title = this.d3TitleBlock.append('h2')
    this.d3ClickMessage = this.d3TitleBlock.append('a')
      .classed('click-message', true)

    this.asyncOperationsChart = this.addContent('AreaChart', {
      classNames: 'block time-block',
      static: false
    })
    this.asyncOperationsChart.initializeElements()

    this.d3TimeBlock = this.asyncOperationsChart.d3ContentWrapper
    this.d3TimeStatement = this.d3TimeBlock.append('p')

    this.ui.on('hover', layoutNode => {
      if (layoutNode) this.layoutNode = layoutNode
      if (this.asyncOperationsChart) this.asyncOperationsChart.applyLayoutNode(layoutNode)
      this.changeVisibility(!!layoutNode)
    })
  }

  nodeLinkPosition (nodePosition) {
    // The SVG element can scale like a responsive image. The HTML hover box doesn't.
    // So, the exact pixel position of the hover box depends on the SVG's current width.
    const svg = this.contentProperties.svg
    const svgContainerBounds = svg.d3Element.node().getBoundingClientRect()
    const responsiveScaleFactor = svgContainerBounds.width / svg.svgBounds.width

    const x = nodePosition.x * responsiveScaleFactor
    const y = nodePosition.y * responsiveScaleFactor
    this.contentProperties.position = { x, y }
    this.position(x, y, svgContainerBounds)
  }

  positionSidewards (x, y, containerBounds, hoverBounds) {
    const horizontalFlip = x + hoverBounds.width > window.innerWidth

    this.d3Element.style('top', y + 'px')
    this.d3Element.style('left', (horizontalFlip ? x - hoverBounds.width : x) + 'px')

    this.d3Element.classed('off-bottom', y + hoverBounds.height > containerBounds.height)
    this.d3Element.classed('horizontal-flip', horizontalFlip)
    this.d3Element.classed('use-vertical-arrow', false)
  }

  position (x, y, containerBounds) {
    const {
      allowableOverflow,
      fixedOrientation
    } = this.contentProperties

    const hoverBounds = this.d3Element.node().getBoundingClientRect()

    const verticalArrowPadding = 12
    const initialTop = y + verticalArrowPadding
    const initialLeft = x - verticalArrowPadding
    const allowableWidth = containerBounds.width + allowableOverflow

    let arrowOffset = verticalArrowPadding
    let adjustedLeft = initialLeft - verticalArrowPadding
    const overflowX = initialLeft + hoverBounds.width - allowableWidth
    if (overflowX > 0) {
      adjustedLeft -= overflowX
      arrowOffset = overflowX + verticalArrowPadding
    }

    let adjustedTop = initialTop
    let verticalFlip = (fixedOrientation === 'up')

    if (!fixedOrientation) {
      const overflowY = initialTop + hoverBounds.height - containerBounds.height
      if (overflowY > 0) {
        const titleBlockHeight = this.d3TitleBlock.node().getBoundingClientRect().height
        adjustedTop -= titleBlockHeight + verticalArrowPadding * 2
        verticalFlip = true
      }
    }

    // On short windows with no space above or below
    if (adjustedTop < 0 && !fixedOrientation) {
      this.positionSidewards(x, y, containerBounds, hoverBounds)
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
    if (!show) {
      this.content.forEach(contentItem => {
        if (contentItem.collapseControl && contentItem.collapseControl.collapsedByDefault) {
          contentItem.collapseClose()
        }
      })
    }
    this.draw()
  }

  showContentAt (htmlContent, position) {
    this.contentProperties.htmlContent = htmlContent
    this.showAt(position)
  }

  showAt (position) {
    this.contentProperties.position = position
    this.changeVisibility(true)
  }

  hide () {
    this.changeVisibility(false)
  }

  draw () {
    super.draw()

    if (this.contentProperties.type === 'node-link') {
      if (this.layoutNode && this.layoutNode !== this.drawnLayoutNode) {
        this.nodeLinkDraw(this.layoutNode)
        this.drawnLayoutNode = this.layoutNode
      }
      return
    }

    const { x, y } = this.contentProperties.position
    this.position(x, y, this.parentContent.d3ContentWrapper.node().getBoundingClientRect())

    if (this.contentProperties.type === 'tool-tip') {
      this.d3TitleBlock.html(this.contentProperties.htmlContent || '')
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

    const percentage = dataNode.stats.overall / this.ui.dataSet.wallTime.profileDuration * 100
    const percentageFormatted = (percentage >= 100 ? '>99' : this.ui.formatNumber(percentage)) + '%'

    this.d3TimeStatement.html(`
      For
      <strong>${this.ui.formatNumber(dataNode.stats.overall)}\u2009ms</strong> (${percentageFormatted} of the profile runtime), async operations were pending from this group.
    `)

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
      case 'ClusterNode': {
        const nodesCount = nodeType === 'ClusterNode' ? dataNode.nodes.size : layoutNode.collapsedNodes.length
        this.d3ClickMessage.text(`Click to expand ${nodesCount} grouped items`)
        this.d3Element.attr('name', 'cluster-node')
        break
      }
    }
    const clickHandler = () => {
      d3.event.stopPropagation()
      this.ui.queueAnimation('selectHoverBoxNode', (animationQueue) => {
        this.ui.selectNode(layoutNode, animationQueue).then(targetUI => {
          this.ui.highlightNode(null)
          if (targetUI !== this.ui) {
            this.ui.originalUI.emit('navigation', { from: this.ui, to: targetUI })
          }
          animationQueue.execute()
        })
      })
    }
    this.d3TitleBlock.on('click', clickHandler)
    this.d3VerticalArrow.on('click', clickHandler)
  }
}

module.exports = HoverBox
