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

    this.ui.on('hover', node => {
      this.isHidden = !node
      this.draw(node)
    })

    this.d3Title = this.d3Element.append('h2')
    this.d3Subtitle = this.d3Title.append('span')
      .classed('subtitle', true)

    this.betweenTime = this.d3Element.append('p')
    this.withinTime = this.d3Element.append('p')
  }

  draw (node) {
    super.draw()

    if (node) {
      const svg = this.contentProperties.svg
      const svgWidth = svg.d3Element.node().getBoundingClientRect().width
      const responsiveScaleFactor = svgWidth / svg.svgBounds.width

      const nodePosition = this.ui.layout.positioning.nodeToPosition.get(node)
      const top = nodePosition.x * responsiveScaleFactor
      const left = nodePosition.y * responsiveScaleFactor

      console.log(responsiveScaleFactor, nodePosition, top, left)

      this.d3Element.style('top', nodePosition.x * responsiveScaleFactor + 'px')
      this.d3Element.style('left', nodePosition.y * responsiveScaleFactor + 'px'  )

      this.d3Title.text(node.name)
      this.d3Subtitle.text(`${node.constructor.name} #${node.id})`)
      this.betweenTime.text(`${this.ui.formatNumber(node.getBetweenTime())}\u2009ms aggregated delay within this bubble.`)
      this.withinTime.text(`${this.ui.formatNumber(node.getWithinTime())}\u2009ms aggregated delay from the previous bubble.`)
    }
  }
}

module.exports = HoverBox
