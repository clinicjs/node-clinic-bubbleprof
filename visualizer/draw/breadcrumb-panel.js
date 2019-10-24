'use strict'

const HtmlContent = require('./html-content.js')

class BreadcrumbPanel extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)

    this.originalUI = contentProperties.originalUI
    this.topmostUI = contentProperties.originalUI
    contentProperties.originalUI.on('setTopmostUI', (newTopmostUI) => {
      this.topmostUI = newTopmostUI
      this.draw()
    })

    document.addEventListener('keydown', (e) => {
      if (e.keyCode === 27 && this.topmostUI !== this.originalUI) {
        // ESC button
        if (this.topmostUI.selectedDataNode) {
          return this.topmostUI.clearFrames()
        }
        const lastUI = this.topmostUI
        const targetUI = this.topmostUI.clearSublayout()
        this.originalUI.emit('navigation', { from: lastUI, to: targetUI })
      }
    })
  }

  initializeElements () {
    super.initializeElements()
    this.d3Element.classed('panel', true)
    this.d3Element.classed('breadcrumbs-panel', true)
  }

  draw () {
    super.draw()

    this.d3Element.selectAll('label').remove()

    let ui = this.topmostUI
    while (ui) {
      this.addLabel(ui)
      ui = ui.parentUI
    }
  }

  addLabel (ui) {
    const fullLabelText = ui.name || 'Main View'
    const labelText = trimToNearestSpace(fullLabelText)
    this.d3Element
      .insert('label', ':first-child') // i.e. prepend instead of append
      .classed('breadcrumb', true)
      .property('textContent', labelText)
      .property('title', fullLabelText)
      .on('click', () => {
        this.traverseUp(ui)
      })

    if (ui !== this.originalUI) {
      this.d3Element
        .insert('label', ':first-child') // i.e. prepend instead of append
        .classed('breadcrumb-separator', true)
        .property('textContent', '➥')
    }
  }

  traverseUp (targetUI) {
    this.topmostUI.queueAnimation('breadcrumb', (animationQueue) => {
      if (this.topmostUI !== targetUI) {
        const currentUI = this.topmostUI.traverseUp(targetUI, { animationQueue })
        if (this.topmostUI !== currentUI) {
          return
        }
      }
      // Didn't animate, kick the queue
      animationQueue.execute()
    })
  }
}

// Attempts to aesthetically limit string length
// Initially it breaks string into words (space split)
// Then it tries to detect a natural break that's not far from the max (15 +/- 3)
// And prioritize such break over a hard cut, if available
function trimToNearestSpace (str) {
  const trimThreshold = 15
  if (str.length < trimThreshold) return str
  const acceptableStretch = 3
  let trimmed = ''
  for (const word of str.split(' ')) {
    const combined = trimmed + ' ' + word
    if (combined.length > trimThreshold + acceptableStretch) {
      const previousSpaceAvailable = trimmed.length > trimThreshold - acceptableStretch && trimmed.length <= trimThreshold
      const resolved = previousSpaceAvailable ? trimmed : combined.slice(0, trimThreshold + 1)
      trimmed = resolved
      break
    }
    trimmed = combined
  }
  trimmed = trimmed.trim() // drop excess spaces
  return trimmed + '…'
}

module.exports = BreadcrumbPanel
