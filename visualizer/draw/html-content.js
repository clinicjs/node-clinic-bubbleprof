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
      hidden: false,
      htmlElementType: 'div',
      htmlContent: '',
      classNames: '',
      title: '',
      eventHandler: null
    }
    this.contentProperties = Object.assign(defaultProperties, contentProperties)
    this.isHidden = this.contentProperties.hidden

    this.collapseControl = null

    this.content = new Map()
    this.contentIds = []
  }

  addContent (className = 'HtmlContent', contentProperties = {}, prepend = false) {
    const ContentClass = this.ui.getContentClass(className)
    const item = new ContentClass(this, contentProperties)

    const identifier = uniqueMapKey(contentProperties.id || ContentClass.name, this.content)

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

    // If this is opening and has a collapseEvent, close everything else with same event
    const collapseEvent = this.collapseControl.collapseEvent
    if (!closeBool && collapseEvent) this.ui.collapseEvent(collapseEvent)

    this.collapseControl.isCollapsed = closeBool
    this.draw()
  }

  // Initial creation of elements independent of data and layout, before .setData() is called
  initializeElements (skipContent = false) {
    const {
      htmlContent,
      htmlElementType,
      id,
      classNames,
      title,
      eventHandler
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

    if (id) this.d3Element.attr('id', id)
    if (title) this.d3Element.attr('title', title)
    if (classNames) this.d3Element.classed(classNames, true)
    if (htmlContent && !skipContent) this.d3ContentWrapper.html(htmlContent)

    if (eventHandler) {
      this.d3Element.on(eventHandler.name, () => {
        eventHandler.func()
      })
    }

    for (const id of this.contentIds) {
      this.content.get(id).initializeElements()
    }
  }

  draw () {
    this.d3Element.classed('hidden', this.isHidden)

    if (this.collapseControl) this.collapseControl.draw()

    if (!this.isHidden) {
      for (const item of this.content.values()) {
        item.draw()
      }
    }
  }
}

class CollapseControl extends HtmlContent {
  constructor (parentContent, contentProperties, collapsedByDefault) {
    super(parentContent, contentProperties)

    this.collapsedByDefault = collapsedByDefault
    this.isCollapsed = collapsedByDefault

    this.closeIcon = contentProperties.closeIcon || null
    this.collapseEvent = contentProperties.collapseEvent || null

    this.portraitOnly = contentProperties.portraitOnly || false
    this.collapseClassName = this.portraitOnly ? 'portrait-collapsed' : 'collapsed'
  }

  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('collapse-control', true)
    this.parentContent.d3Element.classed(this.collapseClassName, this.isCollapsed)

    if (this.portraitOnly) this.d3Element.classed('portrait-only', true)

    if (this.collapseEvent) {
      this.ui.on(`collapse-${this.collapseEvent}`, (closeBool) => {
        this.parentContent.collapseClose()
      })
    }

    this.d3Element.on('click', () => {
      this.parentContent.collapseToggle()
    })
  }

  draw () {
    super.draw()
    this.parentContent.d3Element.classed(this.collapseClassName, this.isCollapsed)
  }
}

module.exports = HtmlContent
