'use strict'

const Section = require('./section.js')

class BubbleprofUI {
  constructor (sections) {
    // Main divisions of the page
    this.sections = new Map()

    for (const sectionName of sections) {
      this.sections.set(sectionName, new Section(sectionName))
    }
  }
  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements (dataSet, layout) {
    this.dataSet = dataSet
    this.layout = layout

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

module.exports = BubbleprofUI
