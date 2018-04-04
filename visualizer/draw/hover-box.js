'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)

    this.isHidden = true
    this.addCollapseControl()
  }

  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('hover-box', true)
    // TODO: have it listen for a global hover event
  }
}

module.exports = HoverBox
