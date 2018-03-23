'use strict'

const Section = require('./section.js')

class BubbleprofUI {
  constructor (dataSet) {
    this.dataSet = dataSet

    // Main divisions of the page
    this.sections = new Map(Object.entries({
      header: new Section('header'),
      sideBar: new Section('side-bar'),
      nodeLink: new Section('node-link'),
      footer: new Section('footer')
    }))

    const footerCollapseHTML = 'Recommendation <span class="up-down-collapse-arrow"></span>'
    this.sections.footer.makeCollapsible(footerCollapseHTML, 'div', 'bar', true)

    this.sections.sideBar.makeCollapsible('✕', 'span', 'close-x', false)
  }
  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements () {
    for (const section of this.sections.values()) {
      section.initialiseElements()
    }
  }
  // For all UI item instances, keep updates and changes to DOM elements in draw() method
  // so that browser paint etc can happen around the same time, minimising reflows
  draw () {
    for (const section of this.sections.values()) {
      section.draw()
    }
  }
}

module.exports = {
  BubbleprofUI
}
