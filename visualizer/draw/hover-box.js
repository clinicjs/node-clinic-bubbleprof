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

    this.ui.on('hover', layoutNode => {
      this.isHidden = !layoutNode
      this.draw(layoutNode)
    })

    this.d3Title = this.d3Element.append('h2')
    this.d3Subtitle = this.d3Title.append('span')
      .classed('subtitle', true)

    this.betweenTime = this.d3Element.append('p')
    this.withinTime = this.d3Element.append('p')
  }

  draw (layoutNode) {
    super.draw()

    if (layoutNode) {
      this.d3Element.on('mouseover', () => {
        this.ui.emit('hover', layoutNode)
      })

      this.d3Element.on('mouseout', () => {
        this.ui.emit('hover', null)
      })

      const svg = this.contentProperties.svg
      const svgWidth = svg.d3Element.node().getBoundingClientRect().width
      const responsiveScaleFactor = svgWidth / svg.svgBounds.width

      const nodePosition = layoutNode.position
      const top = nodePosition.y * responsiveScaleFactor
      const left = nodePosition.x * responsiveScaleFactor

      this.d3Element.style('top', top + 'px')
      this.d3Element.style('left', left + 'px')

      const node = layoutNode.node
      this.d3Title.text(node.name)
      this.d3Subtitle.text(`${node.constructor.name} #${node.id})`)
      this.betweenTime.html(`<strong>${this.ui.formatNumber(node.getBetweenTime())}\u2009ms</strong> aggregated delay from the previous bubble.`)
      this.withinTime.html(`<strong>${this.ui.formatNumber(node.getWithinTime())}\u2009ms</strong> aggregated delay within this bubble.`)
    }
  }
}

module.exports = HoverBox
