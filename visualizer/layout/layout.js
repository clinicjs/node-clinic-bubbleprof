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
      svgDistanceFromEdge: 30,
      lineWidth: 2.5,
      labelMinimumSpace: 14
    }
    this.settings = Object.assign(defaultSettings, settings)
    this.nodes = nodes

    // TODO: re-evaluate this, does it still make sense to initialise these now?
    this.scale = new Scale(this)
    this.positioning = new Positioning(this)

    this.connections = []
    this.connectionsByTargetId = new Map()

    this.stems = new Map()
  }

  prepareLayoutNodes (nodes = this.nodes) {
    this.layoutNodes = new Map()
    nodes.forEach(node => {
      const parent = node.parentId ? this.layoutNodes.get(node.getParentNode().id) : null
      this.layoutNodes.set(node.id, new LayoutNode(node, parent))
    })
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate () {
    for (const layoutNode of this.layoutNodes.values()) {
      layoutNode.stem = new Stem(this, layoutNode)
      const node = layoutNode.node

      if (node.parentId) {
        const sourceNode = node.getParentNode()
        const connection = new Connection(sourceNode, node, this.scale)
        this.connectionsByTargetId.set(node.id, connection)
        this.connections.push(connection)
        layoutNode.inboundConnection = connection
      }
    }
    this.scale.calculateScaleFactor()
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }
}

class LayoutNode {
  constructor (node, parent) {
    this.node = node
    this.stem = null
    this.position = null
    this.inboundConnection = null
    this.parent = parent || null
  }
}

module.exports = Layout
