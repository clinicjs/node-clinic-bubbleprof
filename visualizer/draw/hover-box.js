'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    if (!this.contentProperties.svg) throw new Error('HoverBox requires contentProperties.svg to be defined')

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

    this.d3Title = this.d3TitleBlock.append('h2')
    this.d3ClickMessage = this.d3TitleBlock.append('a')
      .classed('click-message', true)

    this.d3TimeBlock = this.d3ContentWrapper.append('div')
      .classed('block', true)
      .classed('time-block', true)

    this.d3BetweenTime = this.d3TimeBlock.append('p')
    this.d3WithinTime = this.d3TimeBlock.append('p')

    this.ui.on('hover', layoutNode => {
      this.isHidden = !layoutNode
      this.draw(layoutNode)
    })
  }

  positionSidewards (nodePosition, responsiveScaleFactor, svgContainerBounds, bBox) {
    const { width, height } = bBox
    const top = nodePosition.y * responsiveScaleFactor

    const left = nodePosition.x * responsiveScaleFactor
    const horizontalFlip = left + width > window.innerWidth

    this.d3Element.style('top', top + 'px')
    this.d3Element.style('left', (horizontalFlip ? left - width : left) + 'px')

    this.d3Element.classed('off-bottom', top + height > svgContainerBounds.height)
    this.d3Element.classed('horizontal-flip', horizontalFlip)
    this.d3Element.classed('use-vertical-arrow', false)
  }

  position (nodePosition, responsiveScaleFactor, svgContainerBounds, bBox) {
    const { width, height } = bBox
    const verticalArrowPadding = 12
    const initialTop = nodePosition.y * responsiveScaleFactor + verticalArrowPadding
    const initialLeft = nodePosition.x * responsiveScaleFactor - verticalArrowPadding

    let arrowOffset = verticalArrowPadding
    let adjustedLeft = initialLeft - verticalArrowPadding
    const overflowX = initialLeft + width - svgContainerBounds.width
    if (overflowX > 0) {
      adjustedLeft -= overflowX
      arrowOffset = overflowX
    }

    let verticalFlip = false
    let adjustedTop = initialTop
    const overflowY = initialTop + height - svgContainerBounds.height
    if (overflowY > 0) {
      const titleBlockHeight = this.d3TitleBlock.node().getBoundingClientRect().height
      adjustedTop -= titleBlockHeight + verticalArrowPadding * 2
      verticalFlip = true
    }

    // On short windows with no space above or below
    if (adjustedTop < 0) {
      this.positionSidewards(nodePosition, responsiveScaleFactor, svgContainerBounds, bBox)
      return
    }

    this.d3Element.style('top', adjustedTop + 'px')
    this.d3Element.style('left', adjustedLeft + 'px')
    this.d3VerticalArrow.style('left', arrowOffset + 'px')

    this.d3Element.classed('off-bottom', verticalFlip)
    this.d3Element.classed('use-vertical-arrow', true)
    this.d3Element.classed('horizontal-flip', false)
  }

  draw (layoutNode) {
    super.draw()

    if (layoutNode) {
      // Mouseover on the hover box itself causes mouseout of the element that showed the hover box
      // Re-show hover box so mouse/trackpad users can interact with hover content e.g. select text
      this.d3Element.on('mouseover', () => {
        this.ui.highlightNode(layoutNode)
      })

      this.d3Element.on('mouseout', () => {
        this.ui.highlightNode(null)
      })

      // The SVG element scales like a responsive image, the HTML hover box doesn't
      // So the exact pixel position of the hover box depends on the SVG's current width
      const svg = this.contentProperties.svg
      const svgContainerBounds = svg.d3Element.node().getBoundingClientRect()
      const responsiveScaleFactor = svgContainerBounds.width / svg.svgBounds.width

      const nodePosition = layoutNode.position

      // Ensure off-bottom class is not applied before calculating if it's needed
      this.d3Element.classed('off-bottom', false)
      const bBox = this.d3Element.node().getBoundingClientRect()

      this.position(nodePosition, responsiveScaleFactor, svgContainerBounds, bBox)

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
}

module.exports = HoverBox
