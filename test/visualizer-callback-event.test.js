'use strict'

const test = require('tap').test
const CallbackEvent = require('../visualizer/data/callback-event.js')
const {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents,
  expectedClusterResults,
  expectedAggregateResults
} = require('./visualizer-util/fake-overlapping-nodes.js')

// Prepare fake data:

function emptyStats (stop) {
  return {
    async: {
      between: 0,
      within: 0
    },
    sync: 0,
    rawTotals: stop ? null : emptyStats(true)
  }
}

class TestClusterNode {
  constructor (clusterId) {
    const clusterNode = clusterNodes.get(clusterId)
    Object.assign(this, clusterNode)
    this.id = this.clusterId = clusterId
    this.nodes = new Map()
    this.nodeIds = new Set(clusterNode.nodes ? clusterNode.nodes : [])
    this.stats = emptyStats()
  }
}

class TestAggregateNode {
  constructor (aggregateId) {
    Object.assign(this, aggregateNodes.get(aggregateId))
    this.id = this.aggregateId = aggregateId
    this.stats = emptyStats()
  }
}

for (const [aggregateId] of aggregateNodes) {
  aggregateNodes.set(aggregateId, new TestAggregateNode(aggregateId))
}

for (const [clusterId] of clusterNodes) {
  clusterNodes.set(clusterId, new TestClusterNode(clusterId))
}

for (const dummyEvent of dummyCallbackEvents) {
  dummyEvent.init = dummyEvent.delayStart
  dummyEvent.before = [dummyEvent.before]
  dummyEvent.after = [dummyEvent.after]

  dummyEvent.aggregateNode = aggregateNodes.get(dummyEvent.aggregateId)

  dummyEvent.aggregateNode.clusterNode = clusterNodes.get(dummyEvent.clusterId)
  dummyEvent.aggregateNode.clusterNode.nodes.set(dummyEvent.aggregateId, dummyEvent.aggregateNode)

  new CallbackEvent(dummyEvent, 0) // eslint-disable-line no-new
}

CallbackEvent.processAllCallbackEvents()

// Fake data prepared.
// Run tests:

function validateNumber (num) {
  return (typeof num === 'number' && !Number.isNaN(num)) ? num : `not a number (${num}, typeof ${typeof num})`
}

function applyArrayOfObjectKeys (obj, arr) {
  // For example, passing ({ a: { a1: 'foo', a2: 'bar'}, b: null }, ['a', 'a2']) returns 'bar'
  const key = arr.shift()
  if (arr.length) {
    return applyArrayOfObjectKeys(obj[key], arr)
  }
  return obj[key]
}

function compare (dataNode, resultKeysArray, expected, expectedKeysArray) {
  if (!expectedKeysArray) {
    expectedKeysArray = [...resultKeysArray]
    expectedKeysArray.shift()
  }
  const resultKeysString = resultKeysArray.join('.')

  const actualValue = applyArrayOfObjectKeys(dataNode, resultKeysArray)
  const expectedValue = applyArrayOfObjectKeys(expected, expectedKeysArray)

  if (validateNumber(actualValue) === expectedValue) return ''

  return `Error: ${dataNode.constructor.name} ${dataNode.id} ${resultKeysString} is ${actualValue}, expected ${expectedValue}. \n`
}

test('Visualizer data - ClusterNode stats from CallbackEvents', function (t) {
  let errorMessage = ''

  for (const [clusterId, clusterNode] of clusterNodes) {
    const expected = expectedClusterResults.get(clusterId)

    errorMessage += compare(clusterNode, ['stats', 'async', 'within'], expected)
    errorMessage += compare(clusterNode, ['stats', 'async', 'between'], expected)
    errorMessage += compare(clusterNode, ['stats', 'sync'], expected)

    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'async', 'within'], expected)
    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'async', 'between'], expected)
    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'sync'], expected)
  }

  errorMessage = errorMessage || 'Pass'
  t.equals(errorMessage, 'Pass')
  t.end()
})

test('Visualizer data - AggregateNode stats from CallbackEvents', function (t) {
  let errorMessage = ''
  for (const [aggregateId, aggregateNode] of aggregateNodes) {
    const expected = expectedAggregateResults.get(aggregateId)

    errorMessage += compare(aggregateNode, ['stats', 'async', 'between'], expected, ['async'])
    errorMessage += compare(aggregateNode, ['stats', 'async', 'within'], { alwaysZero: 0 }, ['alwaysZero'])
    errorMessage += compare(aggregateNode, ['stats', 'sync'], expected)

    errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'async', 'between'], expected, ['raw'])
    errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'async', 'within'], { alwaysZero: 0 }, ['alwaysZero'])

    if (typeof expected.rawSync === 'undefined') expected.rawSync = expected.sync
    errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'sync'], expected, ['rawSync'])
  }
  errorMessage = errorMessage || 'Pass'
  t.equals(errorMessage, 'Pass')
  t.end()
})
