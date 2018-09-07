const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')

class SideBarDrag extends HtmlContent {
  constructor (d3Container, contentProperties) {
    super(d3Container, contentProperties)

    this.topMostUI = this.ui
    this.ui.on('setTopmostUI', (topMostUI) => {
      this.topMostUI = topMostUI
    })
  }

  initializeElements () {
    super.initializeElements()

    let lastPercent = 0
    this.d3DragBehaviour = d3.drag()
      .on('start', () => {
        lastPercent = this.getCurrentDragWidth({ x: 0 })
        this.showRedrawing()
        d3.select('body').style('cursor', 'ew-resize')
      })
      .on('drag', () => {
        const percent = this.getCurrentDragWidth(d3.event)
        if (percent !== lastPercent) {
          this.setNodeLinkWidth(percent)
        }
        lastPercent = percent
      })
      .on('end', () => {
        const percent = this.getCurrentDragWidth(d3.event)
        if (percent !== lastPercent) {
          this.setNodeLinkWidth(percent)
        }
        lastPercent = percent

        this.redrawLayout()
        d3.select('body').style('cursor', null)
      })

    this.d3Element.call(this.d3DragBehaviour)
  }

  showRedrawing () {
    this.topMostUI.getNodeLinkSection()
      .d3Element.classed('redraw', true)
  }

  setNodeLinkWidth (percent) {
    const sideBar = this.ui.sections.get('side-bar')
    const nodeLink = this.ui.sections.get('node-link')
    const footer = this.ui.sections.get('footer')
    // FIXME this is probably a private API. Is this alright or should the sidebar be its own HtmlContent subclass so it can handle this internally?
    const callbacksOverTime = sideBar.content.get('area-chart')
    const framesButton = footer.collapseControl
    const framesPanel = footer.d3ContentWrapper

    nodeLink.d3Element
      .style('width', `${percent}%`)
      .classed('redraw', true)
    framesPanel
      .style('width', `${percent}%`)
    sideBar.d3Element
      .style('width', `${100 - percent}%`)
    framesButton.d3Element
      .style('width', `${100 - percent}%`)

    // newPercent / defaultPercent
    // maintaining aspect ratio
    callbacksOverTime.chartHeightScale = (100 - percent) / 25
    callbacksOverTime.draw()
  }

  redrawLayout () {
    this.topMostUI.redrawLayout()
    this.topMostUI.getNodeLinkSection()
      .d3Element.classed('redraw', false)
  }

  getCurrentDragWidth ({ x }) {
    const rect = this.d3Element.node()
      .getBoundingClientRect()

    const leftOffset = 24 + rect.left
    let pxSize = leftOffset + x
    const pxAvailable = window.innerWidth

    if (pxSize < 250) pxSize = 250
    if (pxAvailable - pxSize < 250) pxSize = pxAvailable - 250
    return Math.round(pxSize / pxAvailable * 100)
  }
}

module.exports = SideBarDrag
