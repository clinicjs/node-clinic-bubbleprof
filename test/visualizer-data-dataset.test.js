const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const fakeJson = require('./visualizer-util/fakedata.json')
const DataSet = require('../visualizer/data/dataset.js')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')

function round4dp (num) {
  return typeof num === 'number' ? Number(num.toFixed(4)) : num
}

test('Visualizer dataset - fake json', function (t) {
  const dataSet = loadData({ debugMode: true }, fakeJson)

  t.equals(dataSet.clusterNodes.size, 2)
  t.equals(dataSet.aggregateNodes.size, 2)
  t.equals(dataSet.sourceNodes.length, 2)

  t.end()
})

test('Visualizer data - DataSet - empty data file', function (t) {
  t.throws(() => {
    loadData()
  }, new Error('No valid data found, data.json is typeof object'))

  t.end()
})

test('Visualizer data - DataSet - invalid getByNodeType', function (t) {
  t.throws(() => {
    const dataSet = loadData({ debugMode: true }, fakeJson)
    dataSet.getByNodeType('InvalidNode', 0)
  }, new Error('Invalid key "InvalidNode" (typeof string) passed, valid keys are: AggregateNode, ClusterNode'))

  t.end()
})

test('Visualizer data - DataSet - access invalid node id', function (t) {
  const dataSet = loadData({ debugMode: true }, fakeJson)

  t.equal(dataSet.getByNodeType('ClusterNode', 'foo'), undefined)

  t.end()
})

test('Visualizer dataset - wallTime from real sample data', function (t) {
  const dataSet = new DataSet(acmeairJson, { wallTimeSlices: 100 })

  // Ensure stats calculated from real profile data subset don't changed from unexpected future feature side effects
  t.equals(dataSet.wallTime.profileStart, 6783474.641)
  t.equals(dataSet.wallTime.profileEnd, 6786498.31)
  dataSet.processData()
  t.equals(round4dp(dataSet.wallTime.profileDuration), 3023.6690)
  t.equals(round4dp(dataSet.wallTime.msPerSlice), 30.2367)

  // todo - unify variable and class names with UI labels
  const typeDecimals = [
    dataSet.getDecimal('typeCategory', 'networks'),
    dataSet.getDecimal('typeCategory', 'files-streams'),
    dataSet.getDecimal('typeCategory', 'crypto'),
    dataSet.getDecimal('typeCategory', 'timing-promises'),
    dataSet.getDecimal('typeCategory', 'other')
  ]
  t.equals(round4dp(typeDecimals[0]), 0.8461)
  t.equals(round4dp(typeDecimals[1]), 0.0017)
  t.equals(round4dp(typeDecimals[2]), 0)
  t.equals(round4dp(typeDecimals[3]), 0.1521)
  t.equals(round4dp(typeDecimals[4]), 0)
  t.equals(round4dp(typeDecimals.reduce((accum, num) => accum + num, 0)), 1)
  t.equals(dataSet.decimals.typeCategory.size, 5)

  const partyDecimals = [
    dataSet.getDecimal('party', 'user'),
    dataSet.getDecimal('party', 'external'),
    dataSet.getDecimal('party', 'nodecore'),
    dataSet.getDecimal('party', 'root')
  ]
  t.equals(round4dp(partyDecimals[0]), 0.2968)
  t.equals(round4dp(partyDecimals[1]), 0.6829)
  t.equals(round4dp(partyDecimals[2]), 0.0203)
  t.equals(round4dp(partyDecimals[3]), 0)
  t.equals(round4dp(partyDecimals.reduce((accum, num) => accum + num, 0)), 1)
  t.equals(dataSet.decimals.party.size, 4)

  t.equals(dataSet.getDecimal('typeCategory', 'some-key-not-in-map'), null)
  t.equals(dataSet.getDecimal('party', 'some-key-not-in-map'), null)

  t.end()
})

test('Visualizer data - invalid calls to dataSet.wallTime.getSegments', function (t) {
  const { wallTime } = loadData({ debugMode: true }, acmeairJson)

  t.throws(() => {
    wallTime.getSegments(6782000, 6786000)
  }, new Error('Wall time segment start time (6782000) precedes profile start time (6783474.641)'))

  t.throws(() => {
    wallTime.getSegments(6786000, 6789000)
  }, new Error('Wall time segment end time (6789000) exceeds profile end time (6786498.31)'))

  t.throws(() => {
    wallTime.getSegments(6787000, 6786000)
  }, new Error('Wall time segment start time (6787000) doesn’t precede segment end time (6786000)'))

  t.end()
})
