'use strict'

const { uniqueMapKey } = require('../validation.js')

// Base class for HTML content, extended by specific types of UI item
// Only initializeElement() and draw() modify the DOM
class HtmlContent {
  constructor (parentContent, contentProperties = {}, ui = parentContent.ui) {
    this.ui = ui
    this.parentContent = parentContent || this.ui.mainContainer

    const defaultProperties = {
      id: null,
      name: null,
      htmlElementType: 'div',
      htmlContent: '',
      classNames: ''
    }
    this.contentProperties = Object.assign(defaultProperties, contentProperties)

    this.isHidden = false

    this.collapseControl = null
    this.loadingAnimation = null

    this.content = new Map()
    this.contentIds = []
  }

  addContent (ContentClass = HtmlContent, contentProperties = {}, prepend = false) {
    const item = new ContentClass(this, contentProperties)
    const identifier = uniqueMapKey(contentProperties.id || ContentClass.constructor.name, this.content)

    this.content.set(identifier, item)
    this.contentIds[prepend ? 'unshift' : 'push'](identifier)
    return item
  }

  addCollapseControl (collapsedByDefault = false, contentProperties = {}) {
    this.collapseControl = new CollapseControl(this, contentProperties, collapsedByDefault)
    return this.collapseControl
  }

  collapseOpen () {
    this.collapseChange(false)
  }

  collapseClose () {
    this.collapseChange(true)
  }

  collapseToggle () {
    this.collapseChange()
  }

  collapseChange (closeBool) {
    if (!this.collapseControl) return
    if (typeof closeBool === 'undefined') closeBool = !this.collapseControl.isCollapsed
    this.collapseControl.isCollapsed = closeBool
    this.draw()
  }

  addLoadingAnimation (contentProperties = {}) {
    this.loadingAnimation = new LoadingAnimation(this, contentProperties)
    return this.loadingAnimation
  }

  // Initial creation of elements independent of data and layout, before .setData() is called
  initializeElements () {
    const {
      htmlContent,
      htmlElementType,
      id,
      classNames
    } = this.contentProperties

    const d3ParentElement = this.parentContent.d3ContentWrapper

    this.d3Element = d3ParentElement.append(htmlElementType)
    this.d3ContentWrapper = this.d3Element

    if (this.collapseControl) {
      this.collapseControl.initializeElements()
      this.d3ContentWrapper = this.d3Element.append('div')
        .classed('collapsible-content-wrapper', true)

      if (id) this.d3ContentWrapper.attr('id', `${id}-inner`)

      if (this.collapseControl.closeIcon) {
        this.d3ContentWrapper.insert('span', ':first-child')
          .html(this.collapseControl.closeIcon)
          .classed('close', true)
          .classed('portrait-only', this.collapseControl.portraitOnly)
          .on('click', () => this.collapseClose())
      }
    }

    if (this.loadingAnimation) this.loadingAnimation.initializeElements()

    if (id) this.d3Element.attr('id', id)
    if (classNames) this.d3Element.classed(classNames, true)
    if (htmlContent) this.d3ContentWrapper.html(htmlContent)

    for (const id of this.contentIds) {
      this.content.get(id).initializeElements()
    }
  }

  draw () {
    this.d3Element.classed('hidden', this.isHidden)

    if (this.collapseControl) this.collapseControl.draw()
    if (this.loadingAnimation) this.loadingAnimation.draw()

    if (!this.isHidden) {
      for (const item of this.content.values()) {
        item.draw()
      }
    }
  }
}

class CollapseControl extends HtmlContent {
  constructor (parentContent, contentProperties, isCollapsed) {
    super(parentContent, contentProperties)
    this.isCollapsed = isCollapsed
    this.closeIcon = contentProperties.closeIcon
    this.portraitOnly = contentProperties.portraitOnly
    this.collapseClassName = this.portraitOnly ? 'portrait-collapsed' : 'collapsed'
  }
  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('collapse-control', true)
    this.parentContent.d3Element.classed(this.collapseClassName, this.isCollapsed)

    if (this.portraitOnly) this.d3Element.classed('portrait-only', true)

    this.d3Element.on('click', () => {
      this.parentContent.collapseToggle()
    })
  }
  draw () {
    super.draw()
    this.parentContent.d3Element.classed(this.collapseClassName, this.isCollapsed)
  }
}

class LoadingAnimation extends HtmlContent {
  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('loading-indicator', true)

    this.ui.on('complete', () => {
      this.isHidden = true
      this.draw()
    })
  }
}

module.exports = HtmlContent
