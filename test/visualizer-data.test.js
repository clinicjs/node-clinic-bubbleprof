'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')

function validateClusterNode (clusterNode) {
  if (!clusterNode.name) return `(1) fails on clusterId ${clusterNode.clusterId}  `
  if (clusterNode.clusterId <= clusterNode.parentClusterId) return `(2) fails on clusterId ${clusterNode.clusterId}  `
  return ''
}

function validateAggregateNode (aggregateNode) {
  if (!aggregateNode.mark || !aggregateNode.mark.get('party')) return `(3) fails on aggregateId ${aggregateNode.aggregateId}  `
  if (aggregateNode.aggregateId <= aggregateNode.parentAggregateId) return `(4) fails on aggregateId ${aggregateNode.aggregateId}  `
  if (!aggregateNode.isRoot && !aggregateNode.type) return `(5) fails on aggregateId ${aggregateNode.aggregateId}  `
  return ''
}

function validateSourceNode (sourceNode) {
  if (!sourceNode.id) return `(6) fails with no sourceNode id, aggregateId ${sourceNode.aggregateNode.aggregateId}  `
  if (sourceNode.asyncId <= sourceNode.parentAsyncId) return `(7) fails on asyncId ${sourceNode.asyncId}  `
  return ''
}

function validateData (dataSet) {
  let result = ''

  for (const [, clusterNode] of dataSet.clusterNodes) {
    result += validateClusterNode(clusterNode)

    for (const [, aggregateNode] of clusterNode.nodes) {
      result += validateAggregateNode(aggregateNode)

      for (const sourceNode of aggregateNode.sources) {
        result += validateSourceNode(sourceNode)
      }
    }
  }
  result += validateClusterNode(dataSet.getByNodeType('ClusterNode', 1))
  result += validateAggregateNode(dataSet.getByNodeType('AggregateNode', 1))
  result += validateSourceNode(dataSet.getByNodeType('SourceNode', 1))

  return result || 'Pass'
}

test('Visualizer data - examples/slow-io sample json', function (t) {
  const dataSet = loadData(slowioJson)

  t.equals(dataSet.settings.averaging, 'mean')

  t.equals(dataSet.clusterNodes.size, 33)
  t.equals(validateData(dataSet), 'Pass')

  t.end()
})

test('Visualizer data - acmeair sample json', function (t) {
  const dataSet = loadData(acmeairJson, { averaging: 'median' })

  t.equals(dataSet.settings.averaging, 'median')

  t.equals(dataSet.clusterNodes.size, 24)
  t.equals(validateData(dataSet), 'Pass')

  t.end()
})

test('Visualizer data - fake json', function (t) {
  const dataSet = loadData(fakeJson)

  t.equals(dataSet.clusterNodes.size, 2)

  t.end()
})

test('Visualizer data - empty data file', function (t) {
  t.throws(() => {
    loadData()
  }, new Error('No valid data found, data.json is typeof string'))

  t.end()
})

test('Visualizer data - invalid settings', function (t) {
  t.throws(() => {
    loadData({ map: () => {} }, { averaging: 'mode' })
  }, new Error('Invalid key "mode" passed, valid types are: mean, median, sum'))

  t.end()
})

test('Visualizer data - access invalid node id', function (t) {
  const dataSet = loadData(slowioJson)

  t.equal(dataSet.getByNodeType('ClusterNode', 'string'), null)

  t.end()
})
