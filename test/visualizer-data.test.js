'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')

function validateData (data) {
  for (const [clusterId, clusterNode] of data) {
    if (!clusterNode.name) return `1: fails on clusterId ${clusterId}`
    if (clusterId <= clusterNode.parentClusterId) return `2: fails on clusterId ${clusterId}`

    for (const aggregateNode of clusterNode.nodes) {
      if (!aggregateNode.mark.get(0)) return `3:  fails on aggregateId ${aggregateNode.aggregateId}`
      if (aggregateNode.aggregateId <= aggregateNode.parentAggregateId) return `4: fails on aggregateId ${aggregateNode.aggregateId}`
      if (!aggregateNode.isRoot && !aggregateNode.type) return `5: fails on aggregateId ${aggregateNode.aggregateId}`

      for (const sourceNode of aggregateNode.sources) {
        if (!sourceNode.asyncId) return `6: fails with no sourceNode id, aggregateId ${aggregateNode.aggregateId}`
        if (sourceNode.after.length !== sourceNode.callbackEvents.length) return `7:  fails on asyncId ${sourceNode.asyncId}`
        if (sourceNode.asyncId <= sourceNode.parentAsyncId) return `8: fails on asyncId ${sourceNode.asyncId}`
      }
    }
  }
  return 'Pass'
}

test('Visualizer data - examples/slow-io sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.settings.averaging, 'mean')

    t.equals(data.size, 33)
    t.equals(validateData(data), 'Pass')

    t.end()
  }, slowioJson)
})

test('Visualizer data - acmeair sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.settings.averaging, 'median')

    t.equals(data.size, 24)
    t.equals(validateData(data), 'Pass')

    t.end()
  }, acmeairJson, { averaging: 'median' })
})

test('Visualizer data - fake json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 2)

    t.end()
  }, fakeJson)
})

test('Visualizer data - empty data file', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 0)

    t.end()
  })
})
