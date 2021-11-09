'use strict'

const test = require('tap').test
const DataSet = require('../visualizer/data/dataset.js')
const {
  fakeNodes,
  expectedClusterResults,
  expectedAggregateResults
} = require('./visualizer-util/prepare-fake-nodes.js')

// Create real DataSet from fake data
const dataSet = new DataSet({ data: fakeNodes }, { wallTimeSlices: 100 })
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

test('Visualizer data - CallbackEvents - ClusterNode stats from CallbackEvents', function (t) {
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
  t.equal(errorMessage, 'Pass')
  t.end()
})

test('Visualizer data - CallbackEvents - AggregateNode stats from CallbackEvents', function (t) {
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
  t.equal(errorMessage, 'Pass')
  t.end()
})

test('Visualizer data - CallbackEvents - Invalid data item', function (t) {
  t.throws(() => {
    dataSet.clusterNodes.values().next().value.stats.setSync('14%')
  }, new Error('For ClusterNode A stats.sync: Got string 14%, must be a number'))

  t.throws(() => {
    dataSet.clusterNodes.values().next().value.stats.setSync(1 / 0)
  }, new Error('For ClusterNode A stats.sync: Got Infinity, must be finite'))

  t.end()
})

test('Visualizer data - CallbackEvents - Wall time slices', function (t) {
  const wallTime = dataSet.wallTime

  // Ensure essential stats from fake data set are calculated correctly from callback events
  t.equal(wallTime.profileStart, 3)
  t.equal(wallTime.profileEnd, 29.5)
  t.equal(wallTime.profileDuration, 26.5)
  t.equal(wallTime.msPerSlice, 0.265)

  t.equal(wallTime.maxAsyncPending, 5)
  t.equal(wallTime.maxSyncActive, 3)
  t.strictSame(wallTime.categoriesOrdered, ['other', 'networks', 'files-streams'])

  // Simple slice containing two instances of one aggregate node
  const sliceA = wallTime.getSegments(10, 11)
  t.equal(sliceA.length, 5)

  const expected = {
    syncIds: {},
    asyncAggregateIds: { a: 2 }
  }

  let i
  for (i = 0; i < sliceA.length; i++) {
    const {
      asyncPending,
      syncActive
    } = sliceA[i]

    t.equal(syncActive.callbackCount, 0)
    t.strictSame(syncActive.byAggregateId, expected.syncIds)

    t.equal(asyncPending.callbackCount, 2)
    t.strictSame(asyncPending.byAggregateId, expected.asyncAggregateIds)
  }

  // More complex slice
  const sliceB = wallTime.getSegments(22.5, 25)
  t.equal(sliceB.length, 11)

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
        wallTime.getSegments(22.26, 23.32, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 1)
        t.strictSame(syncActive.byAggregateId, {
          d: 1
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 1
        })

        t.equal(asyncPending.callbackCount, 2)
        t.strictSame(asyncPending.byAggregateId, {
          e: 1,
          f: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 1
        })
        break
      case 4: // 23.32 - 23.585
        wallTime.getSegments(23.4, 23.585, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 1)
        t.strictSame(syncActive.byAggregateId, {
          d: 1
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 1
        })

        t.equal(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 2,
          f: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 3
        })
        break
      case 5: // 23.585 - 23.85
        wallTime.getSegments(23.585, 23.85, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 0)
        t.strictSame(syncActive.byAggregateId, {})
        t.strictSame(syncActive.byTypeCategory, {})

        t.equal(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 2,
          f: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 3
        })
        break
      case 6: // 23.85 - 24.115
        wallTime.getSegments(23.85, 24.115, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 2)
        t.strictSame(syncActive.byAggregateId, {
          e: 2
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 2
        })

        t.equal(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 2,
          f: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 3
        })
        break
      case 7: // 24.115 - 24.38
        wallTime.getSegments(24.115, 24.38, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 2)
        t.strictSame(syncActive.byAggregateId, {
          e: 2
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 2
        })

        t.equal(asyncPending.callbackCount, 2)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          f: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 1
        })
        break
      case 8: // 24.38 - 24.645
        wallTime.getSegments(24.38, 24.645, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 2)
        t.strictSame(syncActive.byAggregateId, {
          e: 2
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 2
        })

        t.equal(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 1,
          f: 1,
          g: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 3
        })
        break
      case 9: // 24.645 - 24.91
        wallTime.getSegments(24.645, 24.91, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 1)
        t.strictSame(syncActive.byAggregateId, {
          e: 1
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 1
        })

        t.equal(asyncPending.callbackCount, 4)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 1,
          f: 1,
          g: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 3
        })
        break
      case 10: // 24.91 - 25.175
        wallTime.getSegments(24.91, 25.175, true).forEach((segment) => t.strictSame(segment, sliceB[i]))

        t.equal(syncActive.callbackCount, 3)
        t.strictSame(syncActive.byAggregateId, {
          d: 1,
          e: 2
        })
        t.strictSame(syncActive.byTypeCategory, {
          other: 3
        })

        t.equal(asyncPending.callbackCount, 5)
        t.strictSame(asyncPending.byAggregateId, {
          d: 1,
          e: 1,
          f: 1,
          g: 1,
          h: 1
        })
        t.strictSame(asyncPending.byTypeCategory, {
          'files-streams': 1,
          other: 4
        })
        break
    }
  }

  t.end()
})
