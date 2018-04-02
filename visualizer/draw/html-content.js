'use strict'

const d3 = require('./d3-subset.js')
const { isInstanceOf, uniqueMapKey } = require('../validation.js')

// Base class for HTML content, extended by specific types of UI item
// Only initializeElement() and draw() modify the DOM
class HtmlContent {
  constructor (parentContent = d3.select('body'), contentProperties = {}, ui = parentContent.ui) {
    if (!isInstanceOf(parentContent, [HtmlContent, d3.selection])) {
      const problem = parentContent === Object(parentContent) ? `constructor is ${parentContent.constructor.name}` : `is ${typeof parentContent} ${parentContent}`
      throw new Error(`Invalid parentContent: ${problem}`)
    }

    this.parentContent = parentContent
    this.ui = ui

    const defaultProperties = {
      id: null,
      htmlElementType: 'div',
      htmlContent: '',
      classNames: ''
    }
    this.contentProperties = Object.assign(defaultProperties, contentProperties)

    this.isHidden = false
    this.isCollapsed = this.collapseControl = null

    this.content = new Map()
    this.contentIds = []
  }

  addContent (ContentClass, contentProperties = {}, prepend = false) {
    const item = new ContentClass(this, contentProperties)
    const identifier = uniqueMapKey(contentProperties.id || ContentClass.constructor.name, this.content)

    this.content.set(identifier, item)
    this.contentIds[prepend ? 'unshift' : 'push'](identifier)
    return this
  }

  addCollapseControl (collapsedByDefault = false, contentProperties = {}) {
    this.isCollapsed = collapsedByDefault
    this.collapseControl = new CollapseControl(this, contentProperties)
    return this
  }

  toggleCollapse () {
    this.isCollapsed = !this.isCollapsed
    return this
  }

  addLoadingAnimation (contentProperties = {}) {
    this.loadingAnimation = new LoadingAnimation(this, contentProperties)
    return this
  }

  // Initial creation of elements independent of data and layout, before .setData() is called
  initializeElements () {
    const {
      htmlContent,
      htmlElementType,
      id,
      classNames
    } = this.contentProperties

    const d3ParentElement = this.parentContent.d3ContentWrapper || this.parentContent

    this.d3Element = d3ParentElement.append(htmlElementType)
    this.d3ContentWrapper = this.d3Element

    if (this.collapseControl) {
      this.collapseControl.initializeElements()
      this.d3ContentWrapper = this.d3Element.append('div')
        .classed('collapsible-content-wrapper', true)
    }

    if (this.loadingAnimation) this.loadingAnimation.initializeElements()

    if (id) this.d3Element.attr('id', id)
    if (classNames) this.d3Element.classed(classNames, true)
    if (htmlContent) this.d3Element.html(this.d3Element.html() + htmlContent)

    for (const id of this.contentIds) {
      this.content.get(id).initializeElements()
    }
  }

  draw () {
    this.d3Element.classed('collapsed', this.isCollapsed)
    this.d3Element.classed('hidden', this.isHidden)

    if (!this.isHidden && !this.isCollapsed) {
      for (const item of this.content.values()) {
        item.draw()
      }
    }
  }
}

class CollapseControl extends HtmlContent {
  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('collapse-control', true)

    this.d3Element.on('click', () => {
      this.parentContent.toggleCollapse()
      this.parentContent.draw()
    })
  }
}

class LoadingAnimation extends HtmlContent {
  initializeElements () {
    if (!this.contentProperties.htmlContent) {
      this.contentProperties.htmlContent = '<div class="loading-indicator"></div>'
    }
    super.initializeElements()
  }
  // TODO: listen for 'loaded' event then hide
}

module.exports = HtmlContent
