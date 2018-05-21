'use strict'

const test = require('tap').test
const DataSet = require('../visualizer/data/dataset.js')
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

    errorMessage += compare(clusterNode, ['getBetweenTime()'], expected, ['async', 'between'])
    errorMessage += compare(clusterNode, ['getWithinTime()'], expected, ['withinValue'])

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
  }, new Error('For ClusterNode A stats.sync: Got string 14%, must be a number'))

  t.throws(() => {
    dataSet.clusterNodes.values().next().value.stats.setSync(1 / 0)
  }, new Error('For ClusterNode A stats.sync: Got Infinity, must be finite'))

  t.end()
})

test('Visualizer CallbackEvents - Wall time slices', function (t) {
  const {
    profileStart,
    profileEnd,
    profileDuration,
    msPerPercent,
    getSegments
  } = dataSet.wallTime

  t.equals(profileStart, 3)
  t.equals(profileEnd, 29.5)
  t.equals(profileDuration, 26.5)
  t.equals(msPerPercent, 0.265)

  // Simple slice containing two instances of one aggregate node
  const sliceA = getSegments(10, 11)
  t.equals(sliceA.length, 5)

  const expected = {
    asyncAggregateIds: new Set(['a']),
    asyncAsyncIds: new Set([1, 4]),
    syncIds: new Set()
  }

  let i
  for (i = 0; i < sliceA.length; i++) {
    const {
      asyncPending,
      syncActive
    } = sliceA[i]

    t.equals(syncActive.callbackCount, 0)
    t.strictSame(syncActive.aggregateNodes, expected.syncIds)
    t.strictSame(syncActive.asyncIds, expected.syncIds)

    t.equals(asyncPending.callbackCount, 2)
    t.strictSame(asyncPending.aggregateNodes, expected.asyncAggregateIds)
    t.strictSame(asyncPending.asyncIds, expected.asyncAsyncIds)
  }

  // More complex slice
  const sliceB = getSegments(22.5, 25)
  t.equals(sliceB.length, 11)

  for (i = 0; i < sliceB.length; i++) {
    const {
      asyncPending,
      syncActive
    } = sliceB[i]

    switch (i) { // Comments show time spans in each 1% segment
      case 0: // 22.26 - 22.525
      case 1: // 22.525 - 22.79
      case 2: // 22.79 - 23.055
      case 3: // 23.055 - 23.32
        getSegments(22.26, 23.32, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 1)
        t.strictSame(syncActive.aggregateNodes, new Set(['d']))
        t.strictSame(syncActive.asyncIds, new Set([9]))

        t.equals(asyncPending.callbackCount, 2)
        t.strictSame(asyncPending.aggregateNodes, new Set(['e', 'f']))
        t.strictSame(asyncPending.asyncIds, new Set([10, 12]))
        break
      case 4: // 23.32 - 23.585
        getSegments(23.4, 23.585, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 1)
        t.strictSame(syncActive.aggregateNodes, new Set(['d']))
        t.strictSame(syncActive.asyncIds, new Set([9]))

        t.equals(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 10, 11, 12]))
        break
      case 5: // 23.585 - 23.85
        getSegments(23.585, 23.85, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 0)
        t.strictSame(syncActive.aggregateNodes, new Set())
        t.strictSame(syncActive.asyncIds, new Set())

        t.equals(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 10, 11, 12]))
        break
      case 6: // 23.85 - 24.115
        getSegments(23.85, 24.115, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 2)
        t.strictSame(syncActive.aggregateNodes, new Set(['e']))
        t.strictSame(syncActive.asyncIds, new Set([10, 11]))

        t.equals(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 10, 11, 12]))
        break
      case 7: // 24.115 - 24.38
        getSegments(24.115, 24.38, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 2)
        t.strictSame(syncActive.aggregateNodes, new Set(['e']))
        t.strictSame(syncActive.asyncIds, new Set([10, 11]))

        t.equals(asyncPending.callbackCount, 2)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'f']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 12]))
        break
      case 8: // 24.38 - 24.645
        getSegments(24.38, 24.645, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 2)
        t.strictSame(syncActive.aggregateNodes, new Set(['e']))
        t.strictSame(syncActive.asyncIds, new Set([10, 11]))

        t.equals(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f', 'g']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 11, 12, 14]))
        break
      case 9: // 24.645 - 24.91
        getSegments(24.645, 24.91, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 1)
        t.strictSame(syncActive.aggregateNodes, new Set(['e']))
        t.strictSame(syncActive.asyncIds, new Set([10]))

        t.equals(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f', 'g']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 11, 12, 14]))
        break
      case 10: // 24.91 - 25.175
        getSegments(24.91, 25.175, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equals(syncActive.callbackCount, 3)
        t.strictSame(syncActive.aggregateNodes, new Set(['d', 'e']))
        t.strictSame(syncActive.asyncIds, new Set([9, 10, 11]))

        t.equals(asyncPending.callbackCount, 5)
        t.strictSame(asyncPending.aggregateNodes, new Set(['d', 'e', 'f', 'g', 'h']))
        t.strictSame(asyncPending.asyncIds, new Set([9, 11, 12, 14, 15]))
        break
    }
  }

  t.end()
})
