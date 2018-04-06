'use strict'

const d3 = require('./d3-subset.js')

class SvgContentGroup {
  constructor (svgContainer, contentProperties = {}) {
    this.svgContainer = svgContainer
    this.ui = svgContainer.ui

    const defaultProperties = {
      id: null,
      classNames: '',
      nodeType: 'ClusterNode'
    }
    this.contentProperties = Object.assign(defaultProperties, contentProperties)

    this.ui.on('svgDraw', () => {
      this.draw()
    })
  }

  // Unlike the HtmlContent it's most efficient to setData and initializeElements at same time
  initializeFromData (dataArray) {
    this.dataArray = dataArray
    this.d3Container = this.svgContainer.d3Element

    const {
      classNames,
      id,
      nodeType
    } = this.contentProperties

    this.nodeType = nodeType
    const nodeTypeClass = nodeType === 'ClusterNode' ? 'cluster-nodes' : 'aggregate-nodes'

    this.d3Element = this.d3Container.append('g')
      .classed(classNames, true)
      .classed(nodeTypeClass, true)

    this.d3Enter = this.d3Element.selectAll('.bubble-wrapper')
      .data(dataArray)
      .enter()

    if (id) this.d3Element.attr('id', id)
  }
}

class Links extends SvgContentGroup {
  constructor (svgContainer, contentProperties) {
    super (svgContainer, contentProperties)

    this.ui.on('setData', () => {
    // TODO // this.initializeFromData(this.ui.layout.connections)
    })
  }

  initializeFromData (dataArray) {
    super.initializeFromData(dataArray)
    // TODO
  }

  draw () {
  }
}

module.exports = SvgContentGroup
