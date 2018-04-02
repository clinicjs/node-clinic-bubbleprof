'use strict'

const d3 = require('./d3-subset.js')
const HtmlContent = require('./html-content.js')

class HoverBox extends HtmlContent {
  constructor (d3Container, contentProperties) {
    super(d3Container, contentProperties)

    this.isHidden = true
    this.addCollapseControl()
  }

  initializeElements () {
    super()

    // TODO: have it listen for a global hover event
  }
}

module.exports = HoverBox
