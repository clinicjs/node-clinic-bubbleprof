'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')

function validateClusterNode (clusterNode) {
  if (!clusterNode.name) return `1: fails on clusterId ${clusterNode.clusterId}`
  if (clusterNode.clusterId <= clusterNode.parentClusterId) return `2: fails on clusterId ${clusterNode.clusterId}`
  return ''
}

function validateAggregateNode (aggregateNode) {
  if (!aggregateNode.mark || !aggregateNode.mark.get(0)) return `3: fails on aggregateId ${aggregateNode.aggregateId}`
  if (aggregateNode.aggregateId <= aggregateNode.parentAggregateId) return `4: fails on aggregateId ${aggregateNode.aggregateId}`
  if (!aggregateNode.isRoot && !aggregateNode.type) return `5: fails on aggregateId ${aggregateNode.aggregateId}`
  return ''
}

function validateSourceNode (sourceNode) {
  if (!sourceNode.id) return `6: fails with no sourceNode id, aggregateId ${sourceNode.aggregateNode.aggregateId}`
  if (sourceNode.after.length !== sourceNode.callbackEvents.length) return `7: fails on asyncId ${sourceNode.asyncId}`
  if (sourceNode.asyncId <= sourceNode.parentAsyncId) return `8: fails on asyncId ${sourceNode.asyncId}`
  return ''
}

function validateData (data) {
  let result = ''

  for (const [, clusterNode] of data.clusterNodes) {
    result += validateClusterNode(clusterNode)

    for (const [, aggregateNode] of clusterNode.nodes) {
      result += validateAggregateNode(aggregateNode)

      for (const sourceNode of aggregateNode.sources) {
        result += validateSourceNode(sourceNode)
      }
    }
  }
  result += validateClusterNode(data.getByNodeType('ClusterNode', 1))
  result += validateAggregateNode(data.getByNodeType('AggregateNode', 1))
  result += validateSourceNode(data.getByNodeType('SourceNode', 1))

  return result || 'Pass'
}

test('Visualizer data - examples/slow-io sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.settings.averaging, 'mean')

    t.equals(data.clusterNodes.size, 33)
    t.equals(validateData(data), 'Pass')

    t.end()
  }, slowioJson)
})

test('Visualizer data - acmeair sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.settings.averaging, 'median')

    t.equals(data.clusterNodes.size, 24)
    t.equals(validateData(data), 'Pass')

    t.end()
  }, acmeairJson, { averaging: 'median' })
})

test('Visualizer data - fake json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.clusterNodes.size, 2)

    t.end()
  }, fakeJson)
})

test('Visualizer data - empty data file', function (t) {
  t.throws(() => {
    loadData(() => {})
  }, new Error('No valid data found, data.json is typeof string'))

  t.end()
})

test('Visualizer data - invalid settings', function (t) {
  t.throws(() => {
    loadData(() => {}, { map: () => {} }, { averaging: 'mode' })
  }, new Error('Invalid key "mode" passed, valid types are: mean, median, sum'))

  t.end()
})
