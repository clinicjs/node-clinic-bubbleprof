'use strict'

const d3 = require('./d3-subset.js')
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
    super (parentContent, contentProperties)
    this.isCollapsed = isCollapsed
  }
  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('collapse-control', true)
    this.parentContent.d3Element.classed('collapsed', this.isCollapsed)

    this.d3Element.on('click', () => {
      console.log('On click')
      this.toggleCollapse()
      this.draw()
    })

    console.log(this.contentProperties.htmlContent, this)
  }
  toggleCollapse () {
    console.log('Toggle')
    this.isCollapsed = !this.isCollapsed
  }
  draw () {
    super.draw()
    this.parentContent.d3Element.classed('collapsed', this.isCollapsed)
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
