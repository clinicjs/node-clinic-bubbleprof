'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')

function validateData (data) {
  for (const [clusterId, clusterNode] of data) {
    if (!clusterNode.name) return false
    if (clusterId <= clusterNode.parentClusterId) return false

    for (const aggregateNode of clusterNode.nodes) {
      if (!aggregateNode.mark.get(0)) return false
      if (aggregateNode.aggregateId <= aggregateNode.parentAggregateId) return false
      if (!aggregateNode.isRoot && !aggregateNode.type) return false

      for (const sourceNode of aggregateNode.sources) {
        if (!sourceNode.asyncId) return false
        if (sourceNode.after.length !== sourceNode.callbackEvents.length) return false
        if (sourceNode.asyncId <= sourceNode.parentAsyncId) return false
      }
    }
  }
  return true
}

test('Visualizer data - examples/slow-io sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 33)
    t.ok(validateData(data))

    t.end()
  }, slowioJson)
})

test('Visualizer data - acmeair sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 24)
    t.ok(validateData(data))

    t.end()
  }, acmeairJson)
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
