'use strict'
const BubbleprofUI = require('./bubbleprof-ui.js')
const staticKeyHtml = require('./static-key.js')
const d3 = require('./d3-subset.js')
const eyeIcon = require('@clinic/clinic-common/icons/eye-show')
const extLinkIcon = require('@clinic/clinic-common/icons/external-link')
const arrowUpIcon = require('@clinic/clinic-common/icons/chevron-up')
const closeIcon = require('@clinic/clinic-common/icons/close')

function drawOuterUI () {
  // Initial DOM drawing that is independent of data

  const sections = ['header', 'node-link', 'side-bar', 'footer']
  const ui = new BubbleprofUI(sections)

  // Header
  const header = ui.sections.get('header')
  const highlightBar = header.addContent(undefined, { classNames: 'header-bar highlight-bar' })

  // Analysis code uses term "party" as in "3rd-party", but it may be confusing to users. "Area" is clearer.
  // TODO: repace 'party' with 'area' everywhere in code, including in analysis
  const partyKeyPanel = highlightBar.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Area:</label>' })
  const typeKeyPanel = highlightBar.addContent(undefined, { classNames: 'panel', htmlContent: '<label>Type:</label>' })

  header.addContent(undefined, {
    classNames: 'help-link-block panel',
    htmlContent: `<a class="help-link external-link" href="https://clinicjs.org/bubbleprof/walkthrough" title="External link to Clinic BubbleProf walkthrough"><span>How to use this</span> ${extLinkIcon}</a>`
  })

  header.addContent(undefined, {
    htmlElementType: 'a',
    classNames: 'toggle-theme',
    title: 'Toggle between light and dark themes',
    htmlContent: `${eyeIcon}`,
    eventHandler: {
      name: 'click',
      func: () => {
        const d3Html = d3.select('html')
        // Toggle light theme
        d3Html.classed('light-theme', !d3Html.classed('light-theme'))
      }
    }
  })

  const breadcrumbBar = header.addContent(undefined, { classNames: 'header-bar breadcrumb-bar' })
  breadcrumbBar.addContent('BreadcrumbPanel', { classNames: 'panel', originalUI: ui })

  partyKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'user',
    targetType: 'party',
    label: 'Userland',
    hoverText: 'Operations initiated from inside the application being profiled'
  })
  partyKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'external',
    targetType: 'party',
    label: 'Dependencies',
    hoverText: 'Operations initiated from an external module in node_modules'
  })
  partyKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'nodecore',
    targetType: 'party',
    label: 'Node core',
    hoverText: 'Operations initiated from within node.js core only'
  })

  const asyncHooksDocsLink = 'Async Hook types (<a class="external-link" target="_blank" href="https://nodejs.org/api/async_hooks.html#async_hooks_type" title="External link to official Node.js Async Hooks documentation">see docs</a>):'

  typeKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'networks',
    targetType: 'type',
    label: 'Networks',
    hoverText: 'Async operations related to networks, including TCP, UDP and DNS',
    collapsedText: `${asyncHooksDocsLink}
    <ul>
      <li>HTTPPARSER
      <li>PIPECONNECTWRAP
      <li>PIPEWRAP
      <li>TCPCONNECTWRAP
      <li>TCPSERVER
      <li>TCPWRAP
      <li>TCPSERVERWRAP

      <li>UDPSENDWRAP
      <li>UDPWRAP

      <li>GETADDRINFOREQWRAP
      <li>GETNAMEINFOREQWRAP
      <li>QUERYWRAP
    </ul>
    `
  })
  typeKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'files-streams',
    targetType: 'type',
    label: 'Data',
    hoverText: 'Async operations related to the file system (fs) or data streams',
    collapsedText: `${asyncHooksDocsLink}
    <ul>
      <li>FSEVENTWRAP
      <li>FSREQWRAP
      <li>STATWATCHER

      <li>JSSTREAM
      <li>WRITEWRAP
      <li>SHUTDOWNWRAP

      <li>ZLIB
    </ul>
    `
  })
  typeKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'crypto',
    targetType: 'type',
    label: 'Crypto',
    hoverText: 'Async operations related to cryptography and encryption',
    collapsedText: `${asyncHooksDocsLink}
    <ul>
      <li>PBKDF2REQUEST
      <li>RANDOMBYTESREQUEST
      <li>TLSWRAP
      <li>SSLCONNECTION
    </ul>
    `
  })
  typeKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'timing-promises',
    targetType: 'type',
    label: 'Scheduling',
    hoverText: 'Async wrappers, such as timers, ticks and promises, used to schedule arbitrary code',
    collapsedText: `${asyncHooksDocsLink}
    <ul>
      <li>TIMERWRAP
      <li>Timeout
      <li>Immediate
      <li>TickObject
      <li>PROMISE
    </ul>
    `
  })
  typeKeyPanel.addContent('InteractiveKey', {
    relativeContainer: header,
    name: 'other',
    targetType: 'type',
    label: 'Other',
    hoverText: 'Other async operations, including process wrappers and user-defined Async Hooks',
    collapsedText: `${asyncHooksDocsLink}
    <ul>
      <li>PROCESSWRAP
      <li>TTYWRAP
      <li>SIGNALWRAP
      <li>User-defined async hooks
    </ul>
    `
  })

  // Main panel - nodelink diagram
  const nodeLink = ui.sections.get('node-link')

  const nodeLinkSVG = nodeLink.addContent('SvgContainer', { id: 'node-link-svg', svgBounds: {} })

  nodeLink.addContent('HoverBox', { svg: nodeLinkSVG })

  // Sidebar
  const sideBar = ui.sections.get('side-bar')
  sideBar.addContent('SideBarDrag', {
    classNames: 'side-bar-drag'
  })

  sideBar.addCollapseControl(true, {
    htmlContent: `<div class="text">Details</div>${arrowUpIcon}`,
    classNames: 'bar',
    closeIcon: closeIcon,
    collapseEvent: 'main-overlay',
    portraitOnly: true
  })

  const lookup = sideBar.addContent('Lookup', {
    classNames: 'side-bar-item',
    defaultText: 'Enter a file or function name'
  })
  lookup.addCollapseControl(true, { htmlContent: `Search ${arrowUpIcon}` })

  const callbacksOverTime = sideBar.addContent('AreaChart', {
    id: 'area-chart',
    classNames: 'side-bar-item'
  })
  callbacksOverTime.addCollapseControl(false, { htmlContent: `Async operations ${arrowUpIcon}` })

  const key = sideBar.addContent(undefined, {
    classNames: 'main-key side-bar-item',
    htmlContent: staticKeyHtml
  })
  key.addCollapseControl(false, { htmlContent: `Key ${arrowUpIcon}` })

  /* TODO: Add this when feature is implemented
  sideBar.addContent(undefined, { classNames: 'side-bar-item' })
    .addCollapseControl(true, { htmlContent: 'Stack frames with longest delays ${arrowUpIcon}' })
  */

  // Footer
  const footerCollapseHTML = `<div class="text">Call stacks</div>${arrowUpIcon}`
  const footer = ui.sections.get('footer')
  footer.addCollapseControl(true, {
    htmlContent: footerCollapseHTML,
    classNames: 'bar',
    collapseEvent: 'main-overlay'
  })
  footer.addContent('Frames', { id: 'frames-panel', classNames: 'side-bar-item' })

  // Complete
  ui.initializeElements()

  return ui
}

module.exports = drawOuterUI
