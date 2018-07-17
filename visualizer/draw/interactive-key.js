'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class InteractiveKey extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)

    const {
      hoverText,
      collapsedText,
      relativeContainer
    } = contentProperties

    this.relativeContainer = relativeContainer || this.parentContent

    this.hoverText = hoverText || null
    if (hoverText) this.hoverBox = this.addHoverBox()

    this.collapsedText = collapsedText || null
    if (collapsedText) this.collapsedContent = this.addCollapsedContent(this.hoverBox || this)
  }

  addHoverBox () {
    return this.relativeContainer.addContent('HoverBox', {
      type: 'static',
      htmlContent: this.hoverText,
      allowableOverflow: 24,
      fixedOrientation: 'down'
    })
  }

  addCollapsedContent (infoParent) {
    const collapsedContent = infoParent.addContent(undefined, {
      htmlContent: this.collapsedText,
      classNames: 'details-block block'
    })
    collapsedContent.addCollapseControl(true, {
      htmlContent: this.contentProperties.collapseLabel || 'Details <span class="arrow"></span>'
    })
    return collapsedContent
  }

  initializeElements () {
    if (!this.contentProperties.name) throw new Error('InteractiveKey requires contentProperties.name to be defined')
    if (!this.contentProperties.targetType) throw new Error('InteractiveKey requires contentProperties.targetType to be defined')

    super.initializeElements()
    const {
      name,
      targetType,
      label,
      htmlContent
    } = this.contentProperties

    const eventName = `highlight${targetType.charAt(0).toUpperCase()}${targetType.slice(1)}`
    const targetClass = `${targetType}-${name}`

    this.d3Icon = this.d3Element.append('svg')
      .style('width', '0px')
      .classed('interactive-key-icon', true)
      .classed('bubbleprof', true)

    this.d3IconPath = this.d3Icon
      .append('path')
      .classed('line-segment', true)
      .classed(`${targetType}-icon`, true)
      .classed(targetClass, true)

    this.d3Label = this.d3Element.append('label')
      .html(label)

    this.d3Element.classed(targetClass, true)
    this.d3Element.classed('interactive-key', true)

    this.d3Element.on('mouseover', () => {
      this.ui.emit(eventName, this.contentProperties.name)

      if (this.hoverBox) {
        this.hoverBox.d3TitleBlock.classed(targetClass, true)
        this.hoverBox.d3TitleBlock.classed('by-variable', true)
      }

      const bbox = this.d3Element.node().getBoundingClientRect()
      const hoverBbox = this.hoverBox.d3Element.node().getBoundingClientRect()
      const containerBbox = this.relativeContainer.d3Element.node().getBoundingClientRect()

      if (this.hoverBox) {
        this.hoverBox.showAt({
          x: bbox.left + bbox.width / 2 + hoverBbox.width / 2,
          y: bbox.height + bbox.top - containerBbox.top
        })
      }
    })
    this.d3Element.on('mouseout', () => {
      this.ui.emit(eventName, null)
      if (this.collapsedContent) this.collapsedContent.collapseClose()
      if (this.hoverBox) this.hoverBox.hide()
    })

    this.hoverBox.initializeElements()
    if (this.hoverBox) {
      this.hoverBox.d3Element.on('mouseover', () => {
        this.ui.emit(eventName, this.contentProperties.name)
      })
    }
    if (this.hoverBox) {
      this.hoverBox.d3Element.on('mouseout', () => {
        this.ui.emit(eventName, null)
      })
    }
  }

  draw () {
    const {
      name,
      targetType
    } = this.contentProperties

    super.draw()

    const classification = targetType === 'type' ? 'typeCategory' : targetType
    const decimal = this.ui.dataSet.getDecimal(classification, name)

    const iconWidth = 4 + decimal * 40

    this.d3Icon
      .style('width', `${iconWidth}px`)
      .classed('hidden', false)

    this.d3IconPath
      .attr('d', `M 0 4 L ${iconWidth} 4`)

    this.d3Element.classed('grey-out', !decimal)
  }
}


module.exports = InteractiveKey
