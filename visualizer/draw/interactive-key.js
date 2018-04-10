'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class InteractiveKey extends HtmlContent {
  initializeElements () {
    if (!this.contentProperties.name) throw new Error('InteractiveKey requires contentProperties.name to be defined')
    if (!this.contentProperties.targetType) throw new Error('InteractiveKey requires contentProperties.targetType to be defined')

    const {
      name,
      targetType,
      label,
      htmlContent
    } = this.contentProperties

    const eventName = `highlight${targetType.charAt(0).toUpperCase()}${targetType.slice(1)}`
    const targetClass = `${targetType}-${name}`

    if (!htmlContent) {
      this.contentProperties.htmlContent = `
        <span class="${targetType}-icon"></span><label>${label}</label>
      `
    }
    super.initializeElements()

    this.d3Element.classed(targetClass, true)
    this.d3Element.classed('interactive-key', true)

    this.d3Element.on('mouseover', () => {
      this.ui.emit(eventName, this.contentProperties.name)
    })
    this.d3Element.on('mouseout', () => {
      this.ui.emit(eventName, null)
    })
  }
}

module.exports = InteractiveKey
