const test = require('tap').test
const DataSet = require('../../visualizer/data/dataset.js')
const {
  fakeNodes
} = require('./prepare-fake-nodes.js')
const { GCKey, getGCCount } = require('gckey')

/**
 * These tests are not run by default as they depend on installation of a native addon.
 * Use and modify them if you suspect there is a possible memory leak or garbage collection issue
 *
 * To run:
 *   1: Clone https://github.com/jasnell/gckey.git into node_modules
 *   2: `npm install` in node_modules/gckey to compile
 *   3: Run this test script directly, with the --expose-gc flag, for example:
 *      node --expose-gc test/visualizer-util/verify-garbage-collection.js
 */

if (typeof global.gc !== 'function') throw new Error('This test must be run with the --expose-gc flag')

const dataSet = new DataSet(fakeNodes)

// Add GCkeys so we can count how many items are garbage collected
for (const callbackEvent of dataSet.callbackEvents.array) {
  // In native addon, GCKey increments a counter in V8 when it is garbage collected
  callbackEvent.gcTracker = new GCKey()
}

{ // Confirm that GCkey is working correctly - each of these should increase gc count by 1
  const throwAway = new GCKey()
  if (throwAway) {
    const testTracker = new GCKey()
    dataSet.testTracker = testTracker
  }
}
const callbackEventsGCExpected = dataSet.callbackEvents.array.length + 2

// This should free up all the tracked objects for garbage collection
dataSet.processData()
dataSet.testTracker = null

setImmediate(() => {
  test('Visualizer data - ensure callbackEvents are garbage collected', function (t) {
    global.gc()
    const amountGarbageCollected = getGCCount()
    t.equal(amountGarbageCollected, callbackEventsGCExpected)
    t.end()
  })
})
