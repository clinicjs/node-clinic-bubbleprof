'use strict'

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
        const parentClusterNode = clusterNode.getParentNode()
        const connection = new Connection(parentNode, clusterNode, this.scale)
        this.clusterConnections.push(new Connection(parentNode, clusterNode, this.scale))
        this.aggregateConnections.set(clusterId, [])
      }
      for (const aggregateNode of clusterNode.nodes.values()) {
        aggregateNode.stem = new Stem(aggregateNode)
        if (aggregateNode.parentAggregateId) {
          const parentAggregateNode = aggregateNode.getParentNode()
          const connection = new Connection(parentAggregateNode, aggregateNode, this.scale)
          this.aggregateConnections.get(clusterId).push(connection)
        }
      }
    }
    this.scale.setScaleFactor(this.dataSet)
  }
}

module.exports = Layout
