'use strict'

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

    this.ui.on('initializeFromData', () => {
      this.initializeFromData()
    })

    this.ui.on('setData', () => {
      this.setData()
    })

    this.ui.on('svgDraw', () => {
      this.draw()
    })
  }

  initializeElements () {
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

    if (id) this.d3Element.attr('id', id)
  }

  setData (dataArray, identifier) {
    this.d3Enter = this.d3Element.selectAll(identifier)
      .data(dataArray)
      .enter()
  }
}

module.exports = SvgContentGroup
