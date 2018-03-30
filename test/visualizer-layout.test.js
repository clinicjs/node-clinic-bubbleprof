'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const generateLayout = require('../visualizer/layout/index.js')

function mapToArray (map) {
  return [...map.values()]
}

test('Visualizer layout - stems - calculates between and diameter based on stats', function (t) {
  const dataSet = loadData(slowioJson)
  const layout = generateLayout(dataSet)

  t.equal(layout.clusterConnections.length, dataSet.clusterNodes.size - 1)
  t.equal(layout.aggregateConnections.size, dataSet.clusterNodes.size)
  for (const [clusterId, aggregateConnectionsByClusterId] of layout.aggregateConnections) {
    const aggregateNodes = dataSet.getByNodeType('ClusterNode', clusterId).nodes
    const includesRootAggregateNode = mapToArray(aggregateNodes).find(aggregateNode => aggregateNode.isRoot)
    const expectedSize = includesRootAggregateNode ? aggregateNodes.size - 1 : aggregateNodes.size
    t.equal(aggregateConnectionsByClusterId.length, expectedSize)
  }

  t.end()
})
