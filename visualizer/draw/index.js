'use strict'

const BubbleprofUI = require('./bubbleprof-ui.js')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'side-bar', 'node-link', 'footer']
  const ui = new BubbleprofUI(sections)

  const footerCollapseHTML = '<div class="text">How to use this</div><div class="arrow"></div>'

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
