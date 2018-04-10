'use strict'

const BubbleprofUI = require('./bubbleprof-ui.js')
const HoverBox = require('./hover-box.js')
const InteractiveKey = require('./interactive-key.js')
const SvgContainer = require('./svg-container.js')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'side-bar', 'node-link', 'footer']
  const ui = new BubbleprofUI(sections)

  // Header
  const header = ui.sections.get('header')
  const partyKeyPanel = header.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Party:</label>' })
  const typeKeyPanel = header.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Type:</label>' })
  // TODO: when adding full-screen and light theme
  // const uiButtonsPanel = header.addContent(undefined, { classNames: 'panel' })

  partyKeyPanel.addContent(InteractiveKey, {
    name: 'user',
    targetType: 'party',
    label: 'Your code'
  })
  partyKeyPanel.addContent(InteractiveKey, {
    name: 'external',
    targetType: 'party',
    label: 'Module code'
  })
  partyKeyPanel.addContent(InteractiveKey, {
    name: 'nodecore',
    targetType: 'party',
    label: 'Node core'
  })

  typeKeyPanel.addContent(InteractiveKey, {
    name: 'files-streams',
    targetType: 'type',
    label: 'Files/Streams'
  })
  typeKeyPanel.addContent(InteractiveKey, {
    name: 'networks',
    targetType: 'type',
    label: 'Networks'
  })
  typeKeyPanel.addContent(InteractiveKey, {
    name: 'crypto',
    targetType: 'type',
    label: 'Crypto'
  })
  typeKeyPanel.addContent(InteractiveKey, {
    name: 'timing-promises',
    targetType: 'type',
    label: 'Timing/Promises'
  })
  typeKeyPanel.addContent(InteractiveKey, {
    name: 'other',
    targetType: 'type',
    label: 'Other'
  })

  // Footer
  const footerCollapseHTML = '<div class="text">How to use this</div><div class="arrow"></div>'
  ui.sections.get('footer').addCollapseControl(true, {
    htmlContent: footerCollapseHTML,
    classNames: 'bar'
  })

  // Sidebar
  ui.sections.get('side-bar').addCollapseControl()

  // Main panel - nodelink diagram
  const nodeLink = ui.sections.get('node-link')
  nodeLink.addLoadingAnimation()

  const nodeLinkSVG = nodeLink.addContent(SvgContainer, {id: 'node-link-svg', svgBounds: {}})
  nodeLinkSVG.addBubbles()
  nodeLinkSVG.addLinks()

  nodeLink.addContent(HoverBox)

  ui.initializeElements()
  return ui
}

module.exports = drawOuterUI
