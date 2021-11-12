const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')
const spinner = require('@clinic/clinic-common/spinner')

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

    this.spinner = spinner.attachTo(this.ui.getNodeLinkSection().d3Element.node())

    let lastPercent = 0
    this.d3DragBehaviour = d3.drag()
      .on('start', () => {
        lastPercent = this.getCurrentDragWidth({ x: 0 })
        d3.select('body').style('cursor', 'ew-resize')
      })
      .on('drag', () => {
        this.showRedrawing()
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

  showRedrawing (show = true) {
    if (show) {
      this.spinner.show('Redrawing...')
    } else {
      this.spinner.hide()
    }
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
    this.topMostUI.originalUI.redrawLayout()
    this.showRedrawing(false)
  }

  getCurrentDragWidth ({ x }) {
    const rect = this.d3Element.node()
      .getBoundingClientRect()

    const leftOffset = 24 + rect.left
    let pxSize = leftOffset + x
    const pxAvailable = window.innerWidth

    if (pxSize < 400) pxSize = 400
    if (pxAvailable - pxSize < 250) pxSize = pxAvailable - 250
    return Math.round(pxSize / pxAvailable * 100)
  }
}

module.exports = SideBarDrag
