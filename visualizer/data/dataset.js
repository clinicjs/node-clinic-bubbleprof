'use strict'

const { AllCallbackEvents } = require('./callback-event.js')
const { validateKey } = require('../validation.js')
const { ClusterNode } = require('./data-node.js')

class DataSet {
  constructor (data, settings = {}) {
    if (!data.map) {
      throw new Error(`No valid data found, data.json is typeof ${typeof data}`)
    }

    const defaultSettings = {
      debugMode: false // if true, keeps sourceNodes in memory and exposes dataSet and Layout to window
    }

    settings = Object.assign(defaultSettings, settings)
    this.settings = settings

    this.wallTime = new WallTime()

    // Array of CallbackEvents is temporary for calculating stats on other nodes
    this.callbackEvents = new AllCallbackEvents(this.wallTime) // CallbackEvents are created and pushed within SourceNode constructor
    // Source, Aggregate and Cluster Node maps persist in memory throughout
    if (this.settings.debugMode) this.sourceNodes = [] // SourceNodes are created from and pushed to this array in AggregateNode constructor
    this.aggregateNodes = new Map() // AggregateNodes are created from ClusterNode constructor and set in their own constructor
    this.clusterNodes = new Map()

    for (const node of data) {
      const clusterNode = new ClusterNode(node, this)
      this.clusterNodes.set(node.clusterId, clusterNode)
      clusterNode.generateAggregateNodes(node.nodes)
    }
  }
  processData () {
    this.calculateFlattenedStats()
    this.calculateDecimals()
    this.wallTime.processPercentSlices()
  }
  getByNodeType (nodeType, nodeId) {
    const typeKeyMapping = {
      AggregateNode: 'aggregateNodes',
      ClusterNode: 'clusterNodes'
    }
    validateKey(nodeType, Object.keys(typeKeyMapping))
    return this[typeKeyMapping[nodeType]].get(nodeId)
  }
  calculateFlattenedStats () {
    this.callbackEvents.processAll()
    this.callbackEvents = null
  }
  calculateDecimals () {
    this.aggregateNodes.forEach(aggregateNode => aggregateNode.applyDecimalsToCluster())
  }
}

class WallTime {
  constructor () {
    // Creates array of 100 wall time segments, one for each 1% segment of the total running time
    this.percentSlices = Array.from({length: 100}, () => createWallTimeSlice())

    // Set in callback-event.js AllCallbackEvents.add()
    this.profileStart = 0 // Timestamp of first .init
    this.profileEnd = 0 // Timestamp of last .after

    // Set in callback-event.js AllCallbackEvents.processAll()
    this.profileDuration = null // Number of miliseconds from profileStart to profileEnd
    this.msPerPercent = null // profileDuration / 100, number of miliseconds spanned by each item in percentages array

    this.maxAsyncPending = 0
    this.maxSyncActive = 0
    this.categoriesOrdered = []
  }

  getSegments (startTime, endTime, discardFirst = false) {
    const {
      profileStart,
      profileEnd,
      msPerPercent,
      percentSlices
    } = this

    // Don't allow seemingly valid non-failing output from logically invalid input
    if (startTime < profileStart) throw new Error(`Wall time segment start time (${startTime}) precedes profile start time (${profileStart})`)
    if (endTime > profileEnd) throw new Error(`Wall time segment end time (${endTime}) exceeds profile end time (${profileEnd})`)
    if (startTime > endTime) {
      throw new Error(`Wall time segment start time (${startTime}) doesn’t precede segment end time (${endTime})`)
    }

    const startIndex = Math.floor((startTime - profileStart) / msPerPercent)
    const endIndex = Math.ceil((endTime - profileStart) / msPerPercent)
    const segments = percentSlices.slice(startIndex, endIndex)

    // The last item in getSegments(x, y) is always the same as the first in getSegments(y, z)
    // so use discardFirst when needed to avoid duplication in adjacent segments
    return discardFirst ? segments.slice(1) : segments
  }

  processPercentSlices () {
    const maxAsyncByCategory = {}

    for (var i = 0; i < 100; i++) {
      const percentSlice = this.percentSlices[i]
      if (percentSlice.syncActive.callbackCount > this.maxSyncActive) this.maxSyncActive = percentSlice.syncActive.callbackCount
      if (percentSlice.asyncPending.callbackCount > this.maxAsyncPending) this.maxAsyncPending = percentSlice.asyncPending.callbackCount

      for (const [typeCategory, value] of Object.entries(percentSlice.asyncPending.byTypeCategory)) {
        if (value > (maxAsyncByCategory[typeCategory] || 0)) maxAsyncByCategory[typeCategory] = value
      }
    }

    // Sort so the category with the tallest spike of pending events is first
    this.categoriesOrdered = Object.keys(maxAsyncByCategory).sort((a, b) => {
      return maxAsyncByCategory[b] - maxAsyncByCategory[a]
    })
  }
}

function createWallTimeSlice () {
  // Refers to 1% of the time the profile was running for
  return {
    syncActive: createSubSlice(),
    asyncPending: createSubSlice()
  }
}

function createSubSlice () {
  return {
    byAggregateId: {},
    callbackCount: 0,
    byTypeCategory: {}
  }
}

module.exports = DataSet
