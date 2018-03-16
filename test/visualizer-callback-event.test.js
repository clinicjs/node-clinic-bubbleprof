'use strict'

const test = require('tap').test
const { DataSet } = require('../visualizer/data/data-node.js')
const {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents,
  expectedClusterResults,
  expectedAggregateResults
} = require('./visualizer-util/fake-overlapping-nodes.js')

// Prepare fake data:

class TestClusterNode {
  constructor (clusterId) {
    const clusterNode = clusterNodes.get(clusterId)
    Object.assign(this, clusterNode)
    this.id = this.clusterId = clusterId
  }
}

class TestAggregateNode {
  constructor (aggregateId) {
    Object.assign(this, aggregateNodes.get(aggregateId))
    this.id = this.aggregateId = aggregateId
    this.mark = this.mark || ['dummy', undefined, undefined]
    this.frames = this.frames || []
    this.type = this.type || 'dummyType'
    this.sources = []
  }
}

const nodesArray = []

for (const [aggregateId] of aggregateNodes) {
  aggregateNodes.set(aggregateId, new TestAggregateNode(aggregateId))
}

for (const [clusterId, clusterNode] of clusterNodes) {
  for (var i = 0; i < clusterNode.nodes.length; i++) {
    const aggregateId = clusterNode.nodes[i]
    clusterNode.nodes[i] = aggregateNodes.get(aggregateId)
  }
  clusterNodes.set(clusterId, new TestClusterNode(clusterId))
  nodesArray.push(clusterNodes.get(clusterId))
}

for (const dummyEvent of dummyCallbackEvents) {
  const aggregateNode = aggregateNodes.get(dummyEvent.aggregateId)
  if (typeof dummyEvent.sourceKey !== 'undefined') {
    // Add this to an existing source
    const source = aggregateNode.sources[dummyEvent.sourceKey]
    source.before.push(dummyEvent.before)
    source.after.push(dummyEvent.after)
  } else {
    // Create a new source
    aggregateNode.sources.push({
      init: dummyEvent.delayStart,
      before: [dummyEvent.before],
      after: [dummyEvent.after],
      destroy: dummyEvent.destory || dummyEvent.after + Math.random() * 3
    })
  }
}

const dataSet = new DataSet(nodesArray)

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

  for (const [clusterId, clusterNode] of dataSet.clusterNodes) {
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
  for (const [aggregateId, aggregateNode] of dataSet.aggregateNodes) {
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
