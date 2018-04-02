'use strict'

const HtmlContent = require('./html-content.js')

class BubbleprofUI {
  constructor (sections) {
    // Main divisions of the page
    this.sections = new Map()

    for (const sectionName of sections) {
      this.sections.set(sectionName, new HtmlContent(undefined, {
        htmlElementType: 'section',
        id: sectionName
      }, this))
    }
  }
  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements () {
    for (const section of this.sections.values()) {
      section.initializeElements()
    }
  }

  setData (dataSet, layout) {
    const redraw = dataSet !== this.dataSet || layout !== this.layout
    this.dataSet = dataSet
    this.layout = layout
    if (redraw) this.draw()
  }

  // For all UI item instances, keep updates and changes to DOM elements in draw() method
  // so that browser paint etc can happen around the same time, minimising reflows
  draw () {
    for (const section of this.sections.values()) {
      section.draw()
    }
  }
}

module.exports = BubbleprofUI
