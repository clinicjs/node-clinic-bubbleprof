const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const fakeJson = require('./visualizer-util/fakedata.json')

test('Visualizer dataset - fake json', function (t) {
  const dataSet = loadData(fakeJson)

  t.equals(dataSet.clusterNodes.size, 2)
  t.equals(dataSet.aggregateNodes.size, 2)
  t.equals(dataSet.sourceNodes.size, 2)

  t.end()
})

test('Visualizer data - DataSet - empty data file', function (t) {
  t.throws(() => {
    loadData()
  }, new Error('No valid data found, data.json is typeof string'))

  t.end()
})

test('Visualizer data - DataSet - invalid settings', function (t) {
  t.throws(() => {
    loadData({ map: () => {} }, { averaging: 'mode' })
  }, new Error('Invalid key "mode" passed, valid types are: mean, median, sum'))

  t.end()
})

test('Visualizer data - DataSet - access invalid node id', function (t) {
  const dataSet = loadData(fakeJson)

  t.equal(dataSet.getByNodeType('ClusterNode', 'foo'), undefined)

  t.end()
})
