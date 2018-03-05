'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')

function validateData (data, t) {
  for (const [clusterId, clusterNode] of data) {
    t.ok(clusterNode.name)
    t.ok(clusterId > clusterNode.parentClusterId)

    for (const aggregateNode of clusterNode.nodes) {
      t.ok(aggregateNode.mark.get(0))
      t.ok(aggregateNode.aggregateId > aggregateNode.parentAggregateId)
      if (!aggregateNode.isRoot) t.ok(aggregateNode.type)

      for (const sourceNode of aggregateNode.sources) {
        t.ok(sourceNode.asyncId)
        t.equals(sourceNode.after.length, sourceNode.callbackEvents.length)
        t.ok(sourceNode.asyncId > sourceNode.parentAsyncId)
      }
    }
  }
}

test('Visualizer data - examples/slow-io sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 33)
    validateData(data, t)

    t.end()
  }, slowioJson)
})

test('Visualizer data - acmeair sample json', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equals(data.size, 24)
    validateData(data, t)

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
