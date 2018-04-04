'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')

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
    // then run .setScaleFactor() to calculate scale factor after stems have been calculated
    this.scale = new Scale(nodes, this.settings)

    this.clusterConnections = []
    this.aggregateConnections = new Map() // Map of arrays, one array of agg connections per clusterId
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate () {
    for (const node of this.nodes) {
      this.includeNode(node)
    }
    this.scale.setScaleFactor()
  }

  includeNode (node) {
    const processByType = {
      'ClusterNode': () => {
        const clusterNode = node
        if (clusterNode.parentId) {
          this.addConnection(clusterNode, this.clusterConnections)
        }
        this.aggregateConnections.set(clusterNode.id, [])
        for (const aggregateNode of clusterNode.nodes.values()) {
          this.includeNode(aggregateNode)
        }
      },
      'AggregateNode': () => {
        const aggregateNode = node
        if (aggregateNode.parentId) {
          // Dynamic assignment is necessary when working with subsets
          if (!this.aggregateConnections.has(aggregateNode.clusterNode.id)) {
            this.aggregateConnections.set(aggregateNode.clusterNode.id, [])
          }
          this.addConnection(aggregateNode, this.aggregateConnections.get(aggregateNode.clusterNode.id))
        }
      }
    }
    node.stem = new Stem(node)
    processByType[node.constructor.name]()
  }

  addConnection (targetNode, connectionArray) {
    const sourceNode = targetNode.getParentNode()
    connectionArray.push(new Connection(sourceNode, targetNode, this.scale))
  }
}

module.exports = Layout
