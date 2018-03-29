'use strict'

const Scale = require('./scale.js')
const { Stem } = require('./stems.js')
const Connection = require('./connections.js')

class Layout {
  constructor (dataSet, settings) {
    const defaultSettings = {
      svgWidth: 1000,
      svgHeight: 1000,
      svgDistanceFromEdge: 30
    }
    this.settings = Object.assign(defaultSettings, settings)
    this.dataSet = dataSet

    // Create instance now, place references in appropriate getters while generating stems & connections,
    // then run .setScaleFactor() to calculate scale factor after stems have been calculated
    this.scale = new Scale(dataSet, this.settings)

    this.clusterConnections = []
    this.aggregateConnections = new Map() // map of arrays, one array of agg connections per clusterId
    // If we need an array of stems, it can go here

    // this.layoutStructure = new ClumpedPyramidLayout(...) ?
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate () {
    for (const [clusterId, clusterNode] of this.dataSet.clusterNodes) {
      clusterNode.stem = new Stem(clusterNode)

      if (clusterNode.parentClusterId) {
        this.addConnection(clusterNode, this.clusterConnections)
      }

      this.aggregateConnections.set(clusterId, [])
      for (const aggregateNode of clusterNode.nodes.values()) {
        aggregateNode.stem = new Stem(aggregateNode)

        if (aggregateNode.parentAggregateId) {
          this.addConnection(aggregateNode, this.aggregateConnections.get(clusterId))
        }
      }
    }
    this.scale.setScaleFactor(this.dataSet)
  }

  addConnection (targetNode, connectionArray) {
    const sourceNode = targetNode.getParentNode()
    connectionArray.push(new Connection(sourceNode, targetNode, this.scale))
  }
}

module.exports = Layout
