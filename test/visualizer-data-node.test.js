'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const DataSet = require('../visualizer/data/dataset.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const acmeairJson = require('./visualizer-util/sampledata-acmeair.json')
const { AggregateNode } = require('../visualizer/data/data-node.js')
const {
  fakeNodes,
  expectedTypeCategories,
  expectedTypeSubCategories,
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

  for (const clusterNode of dataSet.clusterNodes.values()) {
    result += validateClusterNode(clusterNode)

    for (const aggregateNode of clusterNode.nodes.values()) {
      result += validateAggregateNode(aggregateNode)
    }
  }

  for (const sourceNode of dataSet.sourceNodes) {
    result += validateSourceNode(sourceNode)
  }

  result += validateClusterNode(dataSet.getByNodeType('ClusterNode', 1))
  result += validateAggregateNode(dataSet.getByNodeType('AggregateNode', 1))

  return result || 'Pass'
}

test('Visualizer data - data nodes - examples/slow-io sample json', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)

  t.equal(dataSet.clusterNodes.size, 33)
  t.equal(validateData(dataSet), 'Pass')

  t.end()
})

test('Visualizer data - data nodes - acmeair sample json', function (t) {
  const dataSet = loadData({ debugMode: true, averaging: 'median' }, acmeairJson)

  t.equal(dataSet.settings.averaging, 'median')

  t.equal(dataSet.clusterNodes.size, 24)
  t.equal(validateData(dataSet), 'Pass')

  t.end()
})

test('Visualizer data - data nodes - less common, preset type categories', function (t) {
  const dataSet = new DataSet({ data: fakeNodes })
  dataSet.processData()
  let result = ''

  for (const [aggregateId, expectedTypeCategory] of expectedTypeCategories) {
    const aggregateNode = dataSet.aggregateNodes.get(aggregateId)
    if (aggregateNode.typeCategory !== expectedTypeCategory) {
      result += `AggregateNode ${aggregateId} has typeCategory "${aggregateNode.typeCategory}", expected "${expectedTypeCategory}".  `
    }
  }

  for (const [aggregateId, expectedTypeSubCategory] of expectedTypeSubCategories) {
    const aggregateNode = dataSet.aggregateNodes.get(aggregateId)
    if (aggregateNode.typeSubCategory !== expectedTypeSubCategory) {
      result += `AggregateNode ${aggregateId} has typeSubCategory "${aggregateNode.typeSubCategory}", expected "${expectedTypeSubCategory}".  `
    }
  }

  // Keep this up to date with https://nodejs.org/api/async_hooks.html#async_hooks_type - gotta categorise them all
  const nodeCoreAsyncTypes = ['FSEVENTWRAP', 'FSREQWRAP', 'GETADDRINFOREQWRAP', 'GETNAMEINFOREQWRAP', 'HTTPPARSER',
    'JSSTREAM', 'PIPECONNECTWRAP', 'PIPEWRAP', 'PROCESSWRAP', 'QUERYWRAP', 'SHUTDOWNWRAP',
    'SIGNALWRAP', 'STATWATCHER', 'TCPCONNECTWRAP', 'TCPSERVER', 'TCPWRAP', 'TIMERWRAP', 'TTYWRAP',
    'UDPSENDWRAP', 'UDPWRAP', 'WRITEWRAP', 'ZLIB', 'SSLCONNECTION', 'PBKDF2REQUEST',
    'RANDOMBYTESREQUEST', 'TLSWRAP', 'Timeout', 'Immediate', 'TickObject']

  for (const type of nodeCoreAsyncTypes) {
    const subCategory = AggregateNode.getAsyncTypeCategories(type)[1]
    if (subCategory === 'user-defined') {
      result += `Node core async_hook type ${type} is not matching to any category.  `
    }
  }
  t.equal(result, '')
  t.end()
})

test('Visualizer data - data nodes - decimals by type, category and party', function (t) {
  function roundTo5Places (num) { return Number(num.toFixed(5)) }

  const dataSet = new DataSet({ data: fakeNodes })
  dataSet.processData()
  let result = ''

  for (const [clusterId, clusterNode] of dataSet.clusterNodes) {
    const expectedByClassification = expectedDecimalsTo5Places.get(clusterId)
    for (const [classification, expectedByPosition] of new Map(Object.entries(expectedByClassification))) {
      for (const [position, expectedByLabel] of new Map(Object.entries(expectedByPosition))) {
        let runningTotal = 0
        for (const [label, expectedValue] of expectedByLabel) {
          const actualValue = clusterNode.getDecimal(classification, position, label)
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

test('Visualizer data - data nodes - set invalid stat', function (t) {
  const dataSet = new DataSet({ data: fakeNodes })
  dataSet.processData()
  const clusterNode = dataSet.clusterNodes.get('A')

  t.throws(() => {
    clusterNode.validateStat(0, '', { aboveZero: true })
  }, new Error('For ClusterNode A: Got 0, must be > 0'))

  t.throws(() => {
    clusterNode.validateStat(Infinity, '')
  }, new Error('For ClusterNode A: Got Infinity, must be finite'))

  t.equal(clusterNode.validateStat(0, ''), 0)
  t.equal(clusterNode.validateStat(Infinity, '', { isFinite: false }), Infinity)

  t.end()
})
