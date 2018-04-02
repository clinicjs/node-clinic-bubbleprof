'use strict'

const BubbleprofUI = require('./bubbleprof-ui.js')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'side-bar', 'node-link', 'footer']
  const ui = new BubbleprofUI(sections)

  const footerCollapseHTML = 'Recommendation <span class="up-down-collapse-arrow"></span>'

  ui.sections.get('footer').addCollapseControl(true, {
    htmlContent: footerCollapseHTML,
    classNames: 'bar'
  })
  ui.sections.get('side-bar').addCollapseControl()

  ui.sections.get('node-link').addLoadingAnimation()


  // TODO: add other boilerplate content and loading graphic
  ui.initializeElements()
  return ui
}

module.exports = drawOuterUI
