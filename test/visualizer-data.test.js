'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const DataSet = require('../visualizer/data/dataset.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const fakeJson = require('./visualizer-util/fakedata.json')
const {
  fakeNodes,
  expectedTypeCategories,
  expectedDecimalsTo5Places
} = require('./visualizer-util/prepare-fake-nodes.js')

function validateClusterNode (clusterNode) {
  if (!clusterNode.name) return `(1) fails on clusterId ${clusterNode.clusterId}  `
  if (clusterNode.clusterId <= clusterNode.parentClusterId) return `(2) fails on clusterId ${clusterNode.clusterId}  `
  return ''
}

function validateAggregateNode (aggregateNode) {
  if (!aggregateNode.mark || !aggregateNode.mark.get('party')) return `(3) fails on aggregateId ${aggregateNode.aggregateId}  `
  if (aggregateNode.aggregateId <= aggregateNode.parentAggregateId) return `(4) fails on aggregateId ${aggregateNode.aggregateId}  `
  if (!aggregateNode.isRoot && !aggregateNode.type) return `(5) fails on aggregateId ${aggregateNode.aggregateId}  `
  if (!(aggregateNode.typeCategory && typeof aggregateNode.typeCategory === 'string')) return `(6) fails on aggregateId ${aggregateNode.aggregateId}  `
  return ''
}

function validateSourceNode (sourceNode) {
  if (!sourceNode.id) return `(7) fails with no sourceNode id, aggregateId ${sourceNode.aggregateNode.aggregateId}  `
  if (sourceNode.asyncId <= sourceNode.parentAsyncId) return `(8) fails on asyncId ${sourceNode.asyncId}  `
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

test('Visualizer data - less common, preset type categories', function (t) {
  const dataSet = new DataSet(fakeNodes)
  dataSet.processData()
  let result = ''

  for (const [aggregateId, expectedTypeCategory] of expectedTypeCategories) {
    const aggregateNode = dataSet.aggregateNodes.get(aggregateId)
    if (aggregateNode.typeCategory !== expectedTypeCategory) {
      result += `AggregateNode ${aggregateId} is "${aggregateNode.typeCategory}", should be "${expectedTypeCategory}".  `
    }
  }

  // Keep this up to date with https://nodejs.org/api/async_hooks.html#async_hooks_type - gotta categorise them all
  const nodeCoreAsyncTypes = ['FSEVENTWRAP', 'FSREQWRAP', 'GETADDRINFOREQWRAP', 'GETNAMEINFOREQWRAP', 'HTTPPARSER',
    'JSSTREAM', 'PIPECONNECTWRAP', 'PIPEWRAP', 'PROCESSWRAP', 'QUERYWRAP', 'SHUTDOWNWRAP',
    'SIGNALWRAP', 'STATWATCHER', 'TCPCONNECTWRAP', 'TCPSERVER', 'TCPWRAP', 'TIMERWRAP', 'TTYWRAP',
    'UDPSENDWRAP', 'UDPWRAP', 'WRITEWRAP', 'ZLIB', 'SSLCONNECTION', 'PBKDF2REQUEST',
    'RANDOMBYTESREQUEST', 'TLSWRAP', 'Timeout', 'Immediate', 'TickObject']

  const sampleAggregateNode = Array.from(dataSet.aggregateNodes.values())[1]
  for (const type of nodeCoreAsyncTypes) {
    sampleAggregateNode.type = type
    sampleAggregateNode.typeCategory = sampleAggregateNode.getTypeCategory()
    if (sampleAggregateNode.typeCategory === 'user-defined') {
      result += `Async_hook type ${type} is not matching to any category.  `
    }
  }
  t.equal(result, '')
  t.end()
})

test('Visualizer data - decimals by type, category and party', function (t) {
  function roundTo5Places (num) { return Number(num.toFixed(5)) }

  const dataSet = new DataSet(fakeNodes)
  dataSet.processData()
  let result = ''

  for (const [clusterId, clusterNode] of dataSet.clusterNodes) {
    const expectedByClassification = expectedDecimalsTo5Places.get(clusterId)
    for (const [classification, expectedByPosition] of new Map(Object.entries(expectedByClassification))) {
      for (const [position, expectedByLabel] of new Map(Object.entries(expectedByPosition))) {
        let runningTotal = 0
        for (const [label, expectedValue] of expectedByLabel) {
          const actualValue = clusterNode.decimals[classification][position].get(label)
          runningTotal += actualValue

          const roundedValue = roundTo5Places(actualValue)
          if (expectedValue !== roundedValue) {
            result += `clusterNode ${clusterId}'s ${classification}.${position}->${label} decimal is ${roundedValue}, expected ${expectedValue}.  `
          }
        }
        const roundedTotal = roundTo5Places(runningTotal)
        if (expectedByLabel.size && roundedTotal !== 1) {
          result += `Total of clusterNode ${clusterId}'s ${classification}.${position} decimals is ${roundedTotal}, should be 1.  `
        }
      }
    }
  }
  t.equal(result, '')
  t.end()
})
