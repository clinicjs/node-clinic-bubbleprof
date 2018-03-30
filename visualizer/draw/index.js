'use strict'

const BubbleprofUI = require('./bubbleprof-ui.js')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'side-bar', 'node-link', 'footer']
  const ui = new BubbleprofUI(sections)

  const footerCollapseHTML = 'Recommendation <span class="up-down-collapse-arrow"></span>'
  ui.sections.footer.makeCollapsible(footerCollapseHTML, 'div', 'bar', true)
  ui.sections.sideBar.makeCollapsible('✕', 'span', 'close-x', false)

  // TODO: add other boilerplate content and loading graphic
  return ui
}

module.exports = drawOuterUI
