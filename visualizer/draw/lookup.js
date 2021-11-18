'use strict'

const HtmlContent = require('./html-content.js')
const debounce = require('lodash/debounce')
const spinner = require('@clinic/clinic-common/spinner')

class Lookup extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    this.defaultText = contentProperties.defaultText
    this.lastInput = ''
    this.topmostUI = null

    this.ui.on('setTopmostUI', (topmostUI) => {
      const stringifiedKeys = () => [...this.topmostUI.layout.layoutNodes.keys()].join()

      const previousNodeIds = this.topmostUI ? stringifiedKeys() : null
      this.topmostUI = topmostUI

      if (previousNodeIds && previousNodeIds !== stringifiedKeys()) {
        // Re-do any current search against new layout
        this.lastInput = ''
        this.onInput()
      }
    })
  }

  initializeElements () {
    super.initializeElements()

    this.spinner = spinner.attachTo(document.querySelector('#side-bar'))
    this.d3Element.classed('lookup', true)

    this.d3LookupInput = this.d3ContentWrapper.append('input')
      .classed('lookup-input', true)
      .classed('default-text', true)
      .property('value', this.defaultText)

    this.d3Suggestions = this.d3ContentWrapper.append('ul')
      .classed('lookup-suggestions', true)
      .classed('hidden', true)

    // Look up autocomplete suggestions when user has stopped typing
    const debouncedChange = debounce(() => {
      // Arrow functions around methods required to preserve `this` context
      this.onInput()
    }, 200)

    // Use keyup so isn't fired while, for example, user holds down delete
    this.d3LookupInput.on('keyup', debouncedChange)

    this.d3LookupInput.on('focus', () => {
      this.onFocus()
    })

    this.d3LookupInput.on('blur', () => {
      this.onBlur()
    })

    this.d3Element.on('mouseout', () => {
      this.tryClearLookup()
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
      // Arrow function to preserve `this` context
      this.tryClearLookup()
    })
  }

  tryClearLookup () {
    // Only clear if the input doesn't have focus and the cursor isn't over any child of this element
    const hasHover = this.d3Element.selectAll(':hover').size()
    const hasFocus = this.d3LookupInput.node() === document.activeElement
    if (!hasHover && !hasFocus) this.clearLookup()
  }

  clearLookup () {
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
    // Clear again in case an earlier lookup resolved while this one was still processing
    this.d3Suggestions.selectAll('li').remove()

    if (inputText === this.defaultText || inputText.length < 3) return
    this.d3Suggestions.selectAll('li').remove()
    this.spinner.show('searching...')

    // Let the spinner show then do the lookup in another tick
    setTimeout(() => {
      const searchResults = this.deepFramesSearch(inputText)
      const matches = searchResults.length
      const pluralizer = matches === 1 ? '' : 'es'
      const resultsMessage = `Found ${matches || 'no'} match${pluralizer}${matches ? ':' : '.'}`

      this.d3Suggestions.append('li')
        .classed('results-count', true)
        .text(resultsMessage)

      for (const { frame, dataNode, layoutNode } of searchResults) {
        this.addSuggestion(frame, dataNode, layoutNode)
      }
      this.spinner.hide()
    }, 20)
  }

  addSuggestion (frame, dataNode, layoutNode) {
    const textString = frame.formatted
      // Add zero-width spaces after slashes to allow long paths to break across lines
      .replace(/\//g, '/&#8203;')
      .replace(/\\/g, '\\&#8203;')
      // Use non-breaking hyphens so file or folder names don't break across lines
      .replace(/-/g, '&#8209;')

    this.d3Suggestions.append('li')
      .classed('suggestion', true)
      .html(textString)
      .on('mouseover', () => {
        this.topmostUI.highlightNode(layoutNode, dataNode)
      })
      .on('mouseout', () => {
        this.topmostUI.highlightNode(null)
      })
      .on('click', () => {
        this.clearLookup()
        this.topmostUI.queueAnimation('searchFrame', (animationQueue) => {
          this.topmostUI.jumpToNode(dataNode, animationQueue).then(targetUI => {
            if (targetUI !== this.ui) {
              this.ui.originalUI.emit('navigation', { from: this.ui, to: targetUI })
            }
          })
        })
      })
  }

  deepFramesSearch (inputText) {
    // Do nothing if user manages to enter input before layout has loaded
    if (!this.topmostUI || !this.topmostUI.layout) return

    const inputStr = inputText.toLowerCase()

    // Enables results to be sorted by quality of match and interestingness of target
    const resultTypesByPriority = [
      [['functionName', 'exact'], []],
      [['fileName', 'exact', 'file'], []],
      [['typeName', 'exact'], []],
      [['functionName', 'start'], []],
      [['fileName', 'start', 'file'], []],
      [['fileName', 'exact', 'folder'], []],
      [['functionName', 'exact', null, 'split'], []],
      [['fileName', 'exact', 'file', 'split'], []],
      [['functionName', 'start', null, 'split'], []],
      [['fileName', 'start', 'file', 'split'], []],
      [['typeName', 'start'], []],
      [['fileName', 'exact', 'folder', 'split'], []],
      [['functionName', 'anywhere'], []],
      [['fileName', 'anywhere', 'file'], []],
      [['fileName', 'start', 'folder', 'split'], []],
      [['typeName', 'anywhere'], []],
      [['fileName', 'anywhere', 'folder'], []]
    ]

    const compare = (testStr, test, uriItem = null, split = null) => {
      if (uriItem) {
        const splitUri = testStr.replace(/\\/g, '/').split('/')
        const fileName = splitUri.pop()

        if (uriItem === 'file') {
          return compare(fileName, test, null, split)
        } else {
          return splitUri.some((folderName) => compare(folderName, test, null, split))
        }
      }

      if (split) {
        const camelFreeStr = testStr.replace(/([a-z])([A-Z])/g, '$1-$2')
        const split = camelFreeStr.replace(/_/g, '-').split('-')
        return split.some((subString) => compare(subString, test, uriItem, null))
      }

      testStr = testStr.toLowerCase()
      switch (test) {
        case 'exact':
          return testStr === inputStr
        case 'start':
          return testStr.match(new RegExp(`^${inputStr}.*`, 'i'))
        case 'anywhere':
          return testStr.match(new RegExp(`.*${inputStr}.*`, 'i'))
      }
    }

    const searchInFrame = (frame, dataNode, layoutNode) => {
      for (const [testConditions, resultsArray] of resultTypesByPriority) {
        const [
          dataType,
          test,
          uriItem,
          split
        ] = testConditions
        const testStr = frame.data[dataType]

        if (testStr && compare(testStr, test, uriItem, split)) {
          resultsArray.push({
            frame,
            dataNode,
            layoutNode
          })
          return
        }
      }
    }

    const searchInNode = (dataNode, layoutNode) => {
      switch (dataNode.constructor.name) {
        case 'AggregateNode':
          for (const frame of dataNode.frames) {
            searchInFrame(frame, dataNode, layoutNode)
          }
          break
        case 'ShortcutNode':
          break
        case 'ArtificialNode':
          for (const collapsedLayoutNode of layoutNode.collapsedNodes) {
            // Don't pass the collapsedLayoutNode down because it's not visible at this level
            searchInNode(collapsedLayoutNode.node, layoutNode)
          }
          break
        case 'ClusterNode':
          for (const aggregateNode of dataNode.nodes.values()) {
            searchInNode(aggregateNode, layoutNode)
          }
          break
      }
    }

    for (const layoutNode of this.topmostUI.layout.layoutNodes.values()) {
      searchInNode(layoutNode.node, layoutNode)
    }
    return resultTypesByPriority.reduce((acc, item) => acc.concat(item[1]), [])
  }
}

module.exports = Lookup
