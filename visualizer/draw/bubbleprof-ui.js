'use strict'

const HtmlContent = require('./html-content.js')
const EventEmitter = require('events')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings) {
    super()

    const defaultSettings = {
      minimumLabelSpace: 14,
      strokePadding: 4,
      strokeWidthOuter: 3,
      strokeWidthInner: 1.5
    }
    this.settings = Object.assign(defaultSettings, settings)

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
    // TODO: try replacing with .emit('initializeElements')
    for (const section of this.sections.values()) {
      section.initializeElements()
    }
  }

  setData (dataSet, layout) {
    const redraw = dataSet !== this.dataSet || layout !== this.layout
    this.dataSet = dataSet
    this.layout = layout
    this.emit('setData')
    if (redraw) this.draw()
  }

  // For all UI item instances, keep updates and changes to DOM elements in draw() method
  // so that browser paint etc can happen around the same time, minimising reflows
  draw () {
    // TODO: try replacing with .emit('draw')
    for (const section of this.sections.values()) {
      section.draw()
    }
  }
}
module.exports = BubbleprofUI
