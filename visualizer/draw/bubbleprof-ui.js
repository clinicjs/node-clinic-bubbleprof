'use strict'

const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')
const EventEmitter = require('events')

class BubbleprofUI extends EventEmitter {
  constructor (sections = [], settings) {
    super()

    const defaultSettings = {
      numberFormatter: d3.format(',.2f'),
      minimumLabelSpace: 14,
      strokePadding: 4,
      strokeWidthOuter: 2
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

  formatNumber (num) {
    return num < 0.01 ? '<0.01' : this.settings.numberFormatter(num)
  }

  truncateLabel (labelString, maxWords, maxChars) {
    const labelWords = labelString.split(' ')
    let truncatedLabel = labelString
    let addEllipsis = false

    if (labelWords.length > maxWords) {
      truncatedLabel = labelWords.slice(0, maxWords).join(' ')
      addEllipsis = true
    }

    if (truncatedLabel.length > maxChars) {
      truncatedLabel = truncatedLabel.slice(0, maxChars - 2)
      addEllipsis = true
    }

    if (addEllipsis) truncatedLabel += '…'

    return truncatedLabel
  }

  // For all UI item instances, keep initial DOM element creation in initializeElements() method
  // so that browser paint etc can happen around the same time, minimising reflows
  initializeElements () {
    const d3Body = d3.select('body')
    d3Body.classed('initialized', true)

    // TODO: try replacing with .emit('initializeElements')
    for (const section of this.sections.values()) {
      section.initializeElements()
    }

    this.on('highlightType', (className) => {
      d3Body.attr('data-highlight-type', className || null)
    })

    this.on('highlightParty', (className) => {
      d3Body.attr('data-highlight-party', className || null)
    })
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
