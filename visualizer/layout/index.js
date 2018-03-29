'use strict'

const { Stem } = require('./stems.js')

function generateLayout (dataSet) {
  generateStems(dataSet)
  // TODO: next layout steps here in sequence: sort, scale, allocate, etc
}

function generateStems (dataSet) {
  for (const clusterNode of dataSet.clusterNodes.values()) {
    clusterNode.stem = new Stem(clusterNode)
    for (const aggregateNode of clusterNode.nodes.values()) {
      aggregateNode.stem = new Stem(aggregateNode)
    }
  }
}

module.exports = generateLayout
