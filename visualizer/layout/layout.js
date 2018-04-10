'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')

class Layout {
  constructor (nodes, settings) {
    const defaultSettings = {
      svgWidth: 1000,
      svgHeight: 1000,
      svgDistanceFromEdge: 30
    }
    this.settings = Object.assign(defaultSettings, settings)
    this.nodes = nodes

    // Create instance now, place references in appropriate getters while generating stems & connections,
    // then run .calculateScaleFactor() to calculate scale factor after stems have been calculated
    this.scale = new Scale(nodes, this.settings)
    this.positioning = new Positioning(this, nodes)

    this.connections = []
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate () {
    for (const node of this.nodes) {
      node.stem = new Stem(node)

      if (node.parentId) {
        const sourceNode = node.getParentNode()
        this.connections.push(new Connection(sourceNode, node, this.scale))
      }
    }
    this.scale.calculateScaleFactor()
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }
}

module.exports = Layout
