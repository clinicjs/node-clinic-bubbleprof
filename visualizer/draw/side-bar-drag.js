const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')

class SideBarDrag extends HtmlContent {
  initializeElements () {
    super.initializeElements()

    const {
      dragOverlay,
      dragIndicator,
      onCommit
    } = this.contentProperties

    this.d3DragBehaviour = d3.drag()
      .on('start', () => {
        dragOverlay.isHidden = false
        dragOverlay.draw()
        const percent = this.getCurrentDragWidth({ x: -16 })
        dragIndicator.d3Element
          .style('left', `${percent}%`)
      })
      .on('end', () => {
        dragOverlay.isHidden = true
        dragOverlay.draw()

        const percent = this.getCurrentDragWidth(d3.event)
        onCommit(percent)
      })
      .on('drag', () => {
        const percent = this.getCurrentDragWidth(d3.event)
        dragIndicator.d3Element
          .style('left', `${percent}%`)
      })

    this.d3Element.call(this.d3DragBehaviour)
  }

  getCurrentDragWidth ({ x }) {
    const rect = this.d3Element.node()
      .getBoundingClientRect()

    const left = 24 + rect.left
    let px = left + x
    const available = window.innerWidth

    if (px < 250) px = 250
    if (available - px < 250) px = available - 250
    return Math.round(px / available * 100)
  }
}

module.exports = SideBarDrag
