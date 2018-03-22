'use strict'

const test = require('tap').test
const { DataSet } = require('../visualizer/data/data-node.js')
const {
  fakeNodes,
  expectedClusterResults,
  expectedAggregateResults
} = require('./visualizer-util/prepare-fake-nodes.js')

// Create real DataSet from fake data
const dataSet = new DataSet(fakeNodes)
dataSet.processData()

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

    if (!aggregateNode.isRoot) {
      errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'async', 'between'], expected, ['raw'])
      errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'async', 'within'], { alwaysZero: 0 }, ['alwaysZero'])

      if (typeof expected.rawSync === 'undefined') expected.rawSync = expected.sync
      errorMessage += compare(aggregateNode, ['stats', 'rawTotals', 'sync'], expected, ['rawSync'])
    }
  }
  errorMessage = errorMessage || 'Pass'
  t.equals(errorMessage, 'Pass')
  t.end()
})
