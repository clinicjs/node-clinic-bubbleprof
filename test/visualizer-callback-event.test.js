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

// For example, passing ({ a: { a1: 'foo', a2: 'bar'}, b: null }, ['a', 'a2']) returns 'bar'
// For example, passing ({ a: { a1: 'foo', getA2: () => bar}, b: null }, ['a', 'getA2()']) returns 'bar'
function applyArrayOfObjectKeys (obj, arr) {
  const key = arr.shift()
  const fnName = key.includes('()') ? key.split('()')[0] : null
  const descendant = fnName ? obj[fnName]() : obj[key]
  if (arr.length) {
    return applyArrayOfObjectKeys(descendant, arr)
  }
  return descendant
}

function compare (dataNode, resultKeysArray, expected, expectedKeysArray) {
  if (!expectedKeysArray) {
    expectedKeysArray = [...resultKeysArray]
    expectedKeysArray.shift()
  }
  const resultKeysString = resultKeysArray.join('.')

  const actualValue = applyArrayOfObjectKeys(dataNode, [...resultKeysArray])
  const expectedValue = applyArrayOfObjectKeys(expected, expectedKeysArray)

  if (validateNumber(actualValue) === expectedValue) return ''

  return `Error: ${dataNode.constructor.name} ${dataNode.id} ${resultKeysString} is ${actualValue}, expected ${expectedValue}. \n`
}

test('Visualizer CallbackEvents - ClusterNode stats from CallbackEvents', function (t) {
  let errorMessage = ''

  for (const [clusterId, clusterNode] of dataSet.clusterNodes) {
    const expected = expectedClusterResults.get(clusterId)

    errorMessage += compare(clusterNode, ['stats', 'async', 'within'], expected, ['async', 'within'])
    errorMessage += compare(clusterNode, ['stats', 'async', 'between'], expected, ['async', 'between'])
    errorMessage += compare(clusterNode, ['stats', 'sync'], expected)

    errorMessage += compare(clusterNode, ['getBetweenValue()'], expected, ['async', 'between'])
    errorMessage += compare(clusterNode, ['getWithinValue()'], expected, ['withinValue'])

    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'async', 'within'], expected)
    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'async', 'between'], expected)
    errorMessage += compare(clusterNode, ['stats', 'rawTotals', 'sync'], expected)
  }

  errorMessage = errorMessage || 'Pass'
  t.equals(errorMessage, 'Pass')
  t.end()
})

test('Visualizer CallbackEvents - AggregateNode stats from CallbackEvents', function (t) {
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

test('Visualizer CallbackEvents - Invalid data item', function (t) {
  t.throws(() => {
    dataSet.clusterNodes.values().next().value.stats.setSync('14%')
  }, new Error('Tried to set string "14%" to ClusterNode A stats.sync, should be number'))

  t.end()
})
