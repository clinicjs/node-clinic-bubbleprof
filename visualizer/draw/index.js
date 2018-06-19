'use strict'

const BubbleprofUI = require('./bubbleprof-ui.js')
const staticKeyHtml = require('./static-key.js')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'node-link', 'side-bar', 'footer']
  const ui = new BubbleprofUI(sections)

  // Header
  const header = ui.sections.get('header')
  const highlightBar = header.addContent(undefined, { classNames: 'header-bar highlight-bar', htmlContent: '<div></div>' })
  const partyKeyPanel = highlightBar.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Party:</label>' })
  const typeKeyPanel = highlightBar.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Type:</label>' })
  const breadcrumbBar = header.addContent(undefined, { classNames: 'header-bar breadcrumb-bar', htmlContent: '<div></div>' })
  breadcrumbBar.addContent('BreadcrumbPanel', { classNames: 'panel', originalUI: ui })
  // TODO: when adding full-screen and light theme
  // const uiButtonsPanel = header.addContent(undefined, { classNames: 'panel' })

  partyKeyPanel.addContent('InteractiveKey', {
    name: 'user',
    targetType: 'party',
    label: 'Your code'
  })
  partyKeyPanel.addContent('InteractiveKey', {
    name: 'external',
    targetType: 'party',
    label: 'Module code'
  })
  partyKeyPanel.addContent('InteractiveKey', {
    name: 'nodecore',
    targetType: 'party',
    label: 'Node core'
  })

  typeKeyPanel.addContent('InteractiveKey', {
    name: 'files-streams',
    targetType: 'type',
    label: 'Files/Streams'
  })
  typeKeyPanel.addContent('InteractiveKey', {
    name: 'networks',
    targetType: 'type',
    label: 'Networks'
  })
  typeKeyPanel.addContent('InteractiveKey', {
    name: 'crypto',
    targetType: 'type',
    label: 'Crypto'
  })
  typeKeyPanel.addContent('InteractiveKey', {
    name: 'timing-promises',
    targetType: 'type',
    label: 'Timing/Promises'
  })
  typeKeyPanel.addContent('InteractiveKey', {
    name: 'other',
    targetType: 'type',
    label: 'Other'
  })

  // Main panel - nodelink diagram
  const nodeLink = ui.sections.get('node-link')
  nodeLink.addLoadingAnimation()

  const nodeLinkSVG = nodeLink.addContent('SvgContainer', {id: 'node-link-svg', svgBounds: {}})

  nodeLink.addContent('HoverBox', {svg: nodeLinkSVG})

  // Sidebar
  const sideBar = ui.sections.get('side-bar')
  sideBar.addCollapseControl(true, {
    htmlContent: '<div class="text">Details</div><div class="arrow"></div>',
    classNames: 'bar',
    closeIcon: '×',
    collapseEvent: 'main-overlay',
    portraitOnly: true
  })

  const callbacksOverTime = sideBar.addContent('LineChart', {
    classNames: 'side-bar-item'
  })
  callbacksOverTime.addCollapseControl(false, { htmlContent: 'Async operations over time <span class="arrow"></span>' })

  const lookup = sideBar.addContent('Lookup', {
    classNames: 'side-bar-item',
    defaultText: 'Enter a file or function name'
  })
  lookup.addCollapseControl(true, { htmlContent: 'Locate a stack frame <span class="arrow"></span>' })
  lookup.addLoadingAnimation({ hidden: true })

  const key = sideBar.addContent(undefined, {
    classNames: 'main-key side-bar-item',
    htmlContent: staticKeyHtml
  })
  key.addCollapseControl(false, { htmlContent: 'Key <span class="arrow"></span>' })

  /* TODO: Add this when feature is implemented
  sideBar.addContent(undefined, { classNames: 'side-bar-item' })
    .addCollapseControl(true, { htmlContent: 'Stack frames with longest delays <span class="arrow"></span>' })
  */

  // Footer
  const footerCollapseHTML = '<div class="text">Stack frames</div><div class="arrow"></div>'
  const footer = ui.sections.get('footer')
  footer.addCollapseControl(true, {
    htmlContent: footerCollapseHTML,
    classNames: 'bar',
    collapseEvent: 'main-overlay',
    closeIcon: '×'
  })
  footer.addContent('Frames', { id: 'frames-panel', classNames: 'side-bar-item' })

  // Complete
  ui.initializeElements()

  return ui
}

module.exports = drawOuterUI
