'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class InteractiveKey extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)

    const {
      hoverText,
      collapsedText
    } = contentProperties

    this.hoverText = hoverText || null
    if (hoverText) this.hoverBox = this.addHoverBox()

    this.collapsedText = collapsedText || null
    if (collapsedText) this.collapsedContent = this.addCollapsedContent(this.hoverBox || this)
  }

  addHoverBox () {
    return this.addContent('HoverBox', {
      htmlContent: this.hoverText,
      type: 'tool-tip',
      allowableOverflow: 48
    })
  }

  addCollapsedContent (infoParent) {
    console.log(infoParent)
    const collapsedContent = infoParent.addContent(undefined, {
      htmlContent: this.collapsedText
    })
    collapsedContent.addCollapseControl(true, {
      htmlContent: this.contentProperties.collapseLabel ||  'More details <span class="arrow"></span>'
    })
    return collapsedContent
  }

  initializeElements () {
    if (!this.contentProperties.name) throw new Error('InteractiveKey requires contentProperties.name to be defined')
    if (!this.contentProperties.targetType) throw new Error('InteractiveKey requires contentProperties.targetType to be defined')

      console.log(this.contentProperties)

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
        <span style="border-width: ${this.ui.settings.lineWidth}px;" class="${targetType}-icon"></span><label>${label}</label>
      `
    }
    super.initializeElements()

    this.d3Element.classed(targetClass, true)
    this.d3Element.classed('interactive-key', true)

    this.d3Element.on('mouseover', () => {
      this.ui.emit(eventName, this.contentProperties.name)
      if (this.hoverBox) this.hoverBox.show()
    })
    this.d3Element.on('mouseout', () => {
      this.ui.emit(eventName, null)
      if (this.hoverBox) this.hoverBox.hide()
    })
  }
}

module.exports = InteractiveKey
