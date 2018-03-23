'use strict'

const d3 = require('./d3.js')

class Section {
  constructor (id) {
    this.id = id
    this.collapsibleProperties = null
    this.content = new Map()
  }
  makeCollapsible (htmlContent, htmlElementType = 'div', classNames = '', collapsedByDefault = false) {
    this.isCollapsed = collapsedByDefault

    this.collapsibleProperties = {
      htmlContent,
      htmlElementType,
      classNames
    }
  }
  addContent (identifier, item) {
    this.content.set(item, identifier)
  }
  initializeElements () {
    this.wrapper = d3.select('body').append('section')
      .attr('id', this.id)

    if (this.collapsibleProperties) {
      const {
        htmlContent,
        htmlElementType,
        classNames
      } = this.collapseControlProperties

      this.collapsibleControl = this.wrapper.insert(htmlElementType, ':first-child')
        .html(htmlContent)
        .classed(classNames, true)
        .on('click', () => {
          this.isCollapsed = !this.isCollapsed
          this.wrapper.classed('collapsed', this.isCollapsed)
        })

      this.wrapper.classed('collapsed', this.isCollapsed)
    }

    for (const item of this.content.values()) {
      item.initializeElements()
    }
  }
  draw () {
    for (const item of this.content.values()) {
      item.draw()
    }
  }
}

module.exports = Section
