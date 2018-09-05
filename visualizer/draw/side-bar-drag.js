const HtmlContent = require('./html-content.js')
const d3 = require('./d3-subset.js')

class SideBarDrag extends HtmlContent {
  initializeElements () {
    super.initializeElements()

    const { onDrag, onCommit } = this.contentProperties

    let lastPercent = 0
    this.d3DragBehaviour = d3.drag()
      .on('start', () => {
        lastPercent = this.getCurrentDragWidth({ x: 0 })
      })
      .on('drag', () => {
        const percent = this.getCurrentDragWidth(d3.event)
        if (percent !== lastPercent) {
          onDrag(percent)
        }
        lastPercent = percent
      })
      .on('end', () => {
        const percent = this.getCurrentDragWidth(d3.event)
        if (percent !== lastPercent) {
          onDrag(percent)
        }
        lastPercent = percent
        onCommit(percent)
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
