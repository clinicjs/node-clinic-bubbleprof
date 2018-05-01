'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    if (!this.contentProperties.svg) throw new Error('InteractiveKey requires contentProperties.svg to be defined')

    this.isHidden = true
  }

  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('hover-box', true)
    this.d3Element.classed('hidden', true)

    this.d3TitleBlock = this.d3Element.append('div')
      .classed('block', true)
      .classed('title-block', true)

    this.d3Title = this.d3TitleBlock.append('h2')
    this.d3ClickMessage = this.d3TitleBlock.append('a')
      .classed('click-message', true)

    this.d3TimeBlock = this.d3Element.append('div')
      .classed('block', true)
      .classed('time-block', true)

    this.d3BetweenTime = this.d3TimeBlock.append('p')
    this.d3WithinTime = this.d3TimeBlock.append('p')

    this.ui.on('hover', layoutNode => {
      this.isHidden = !layoutNode
      this.draw(layoutNode)
    })
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
      const {
        width: svgWidth,
        height: svgHeight
      } = svg.d3Element.node().getBoundingClientRect()
      const responsiveScaleFactor = svgWidth / svg.svgBounds.width

      const nodePosition = layoutNode.position
      const top = nodePosition.y * responsiveScaleFactor
      const left = nodePosition.x * responsiveScaleFactor

      this.d3Element.style('top', top + 'px')
      this.d3Element.style('left', left + 'px')

      const dataNode = layoutNode.node
      const nodeType = dataNode.constructor.name

      this.d3Title.text(dataNode.name)

      // TODO: find a more appropriate way to communicate the time of ShortcutNodes, taking into
      // account that they refer to nodes at a different level so aren't directly comparable
      if (nodeType !== 'ShortcutNode') {
        this.d3BetweenTime.html(`<strong>${this.ui.formatNumber(dataNode.getBetweenTime())}\u2009ms</strong> aggregated delay from the previous bubble.`)
        this.d3WithinTime.html(`<strong>${this.ui.formatNumber(dataNode.getWithinTime())}\u2009ms</strong> aggregated delay within this bubble.`)
      }

      switch (nodeType) {
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
          this.d3ClickMessage.text(`Click to expand ${nodesCount} grouped async_hooks`)
          this.d3Element.attr('name', 'cluster-node')
          break
      }
      this.d3ClickMessage.on('click', () => {
        this.ui.selectNode(layoutNode)
        this.ui.highlightNode(null)
      })

      const boxHeight = this.d3Element.node().getBoundingClientRect().height
      this.d3Element.classed('off-bottom', top + boxHeight > svgHeight)
    }
  }
}

module.exports = HoverBox
