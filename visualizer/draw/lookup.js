'use strict'

const HtmlContent = require('./html-content.js')
const debounce = require('lodash/debounce')

class Lookup extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    this.defaultText = contentProperties.defaultText
    this.lastInput = ''

    this.ui.on('setTopmostLayout', (layout) => {
      let previousNodeIds = this.topmostLayout ? [...this.topmostLayout.layoutNodes.keys()].join() : ''
      this.topmostLayout = layout

      const newNodeIds = [...this.topmostLayout.layoutNodes.keys()].join()

      if (previousNodeIds && previousNodeIds !== newNodeIds) {
        // Re-do any current search against new layout
        this.lastInput = ''
        this.onInput()
      }
    })
  }

  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('lookup', true)

    this.d3LookupInput = this.d3ContentWrapper.append('input')
      .classed('lookup-input', true)
      .classed('default-text', true)
      .property('value', this.defaultText)

    this.d3Suggestions = this.d3ContentWrapper.append('ul')
      .classed('lookup-suggestions', true)
      .classed('hidden', true)

    this.d3LookupInput.on('focus', () => {
      this.onFocus()
    })

    this.d3LookupInput.on('blur', () => {
      this.onBlur()
    })

    // Look up autocomplete suggestions when user has stopped typing
    const debouncedChange = debounce(() => {
      this.onInput()
    }, 200)

    // Use keyup so isn't fired while, for example, user holds down delete
    this.d3LookupInput.on('keyup', () => {
      debouncedChange()
    })

    this.d3Element.on('mouseout', () => {
      this.clearLookup()
    })
  }

  onFocus () {
    if (this.d3LookupInput.property('value') === this.defaultText) {
      this.d3LookupInput.property('value', '')
      this.d3LookupInput.classed('default-text', false)
    }
    this.d3Suggestions.classed('hidden', false)
  }

  onBlur () {
    if (this.d3LookupInput.property('value') === '') {
      this.d3LookupInput.property('value', this.defaultText)
      this.d3LookupInput.classed('default-text', true)
      this.lastInput = ''
    }
    // Try to clear after current event stack resolves (e.g. click on a suggestion)
    setTimeout(() => {
      this.clearLookup()
    })
  }

  clearLookup () {
    // Only clear if the input doesn't have focus and the cursor isn't over any child of this element
    const hasHover = this.d3Element.selectAll(':hover').size()
    const hasFocus = this.d3LookupInput.node() === document.activeElement
    if (hasHover || hasFocus) return

    this.d3Suggestions
      .classed('hidden', true)
      .selectAll('li').remove()
  }

  onInput () {
    this.d3LookupInput.classed('default-text', false)
    const inputText = this.d3LookupInput.property('value').trim()
    if (inputText !== this.lastInput) {
      this.lookupFrames(inputText)
      this.lastInput = inputText
    }
  }

  lookupFrames (inputText) {
    this.d3Suggestions.selectAll('li').remove()

    if (inputText === this.defaultText || inputText.length < 3) return

    this.d3Element.classed('loading', true)

    // Let the .loading message show then do the lookup in another tick
    setTimeout(() => {
      // Clear again in case an earlier lookup resolved while this one was still processing
      this.d3Suggestions.selectAll('li').remove()

      this.addSuggestion(`Look up <em>${inputText}</em>`)
      this.d3Element.classed('loading', false)
    }, 600) // <-- delete this 600 after adding real data lookup: is for testing loading message only
  }

  addSuggestion (descriptionHTML) {
    this.d3Suggestions.append('li')
      .classed('suggestion', true)
      .html(descriptionHTML)
  }
}

module.exports = Lookup
