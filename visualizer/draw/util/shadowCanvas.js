class ShadowCanvas {
  constructor (width, height) {
    this.canvasElement = document.createElement('canvas')

    this.ctx = this.canvasElement.getContext('2d')
    this.colourIndex = 1
    this.dataMap = {}
  }

  setDimensions (width, height) {
    this.canvasElement.setAttribute('width', width)
    this.canvasElement.setAttribute('height', height)
  }

  addDataItem (dataItem) {
    var ret = []
    if (this.colourIndex < 16777215) {
      ret.push(this.colourIndex & 0xff) // R
      ret.push((this.colourIndex & 0xff00) >> 8) // G
      ret.push((this.colourIndex & 0xff0000) >> 16) // B
      this.colourIndex += 1
    }
    var col = 'rgb(' + ret.join(',') + ')'
    this.dataMap[col] = dataItem

    return col
  }

  getData (mouseEvent) {
    const { offsetX, offsetY } = mouseEvent
    const col = this.ctx.getImageData(offsetX, offsetY, 1, 1).data
    return this.dataMap['rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')']
  }

  clear () {
    this.colourIndex = 1
    this.dataMap = {}
    this.ctx.clearRect(0, 0, this.canvasElement.getAttribute('width'), this.canvasElement.getAttribute('height'))
  }
}

module.exports = ShadowCanvas
