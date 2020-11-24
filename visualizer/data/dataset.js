'use strict'

const { AllCallbackEvents } = require('./callback-event.js')
const {
  validateKey,
  validateNumber
} = require('../validation.js')
const { ClusterNode } = require('./data-node.js')

class DataSet {
  constructor (json, settings = {}) {
    if (!json.data || !json.data.map) {
      throw new Error(`No valid data found, data.json is typeof ${typeof json}`)
    }

    const data = json.data

    const defaultSettings = {
      debugMode: false, // if true, keeps sourceNodes in memory and exposes dataSet and Layout to window
      wallTimeSlices: 400
    }

    settings = Object.assign(defaultSettings, settings)
    this.settings = settings

    this.wallTime = new WallTime(this.settings.wallTimeSlices)
    this.decimals = {
      type: new Map(),
      typeCategory: new Map(),
      party: new Map()
    }
    // Note: raw totals do not take overlaps (simulataneous delays) into account, therefore will be thousands of times greater than total runtime.
    // Use for calculating approximate decimals attributable to types only. Not for reporting to user.
    this.rawTotalTime = 0

    // Array of CallbackEvents is temporary for calculating stats on other nodes
    this.callbackEvents = new AllCallbackEvents(this.wallTime) // CallbackEvents are created and pushed within SourceNode constructor
    this.callbackEventsCount = 0

    // Source, Aggregate and Cluster Node maps persist in memory throughout
    this.sourceNodesCount = 0
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
    this.wallTime.processSlices()
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
    this.callbackEventsCount = this.callbackEvents.array.length
    this.callbackEvents = null
  }

  calculateDecimals () {
    this.aggregateNodes.forEach(aggregateNode => {
      aggregateNode.applyDecimalsToCluster()
      this.applyDecimals(aggregateNode)
    })
  }

  applyDecimals (aggregateNode) {
    const totalTime = aggregateNode.stats.rawTotals.sync + aggregateNode.stats.rawTotals.async.between
    this.setDecimal(totalTime, 'type', aggregateNode.type)
    this.setDecimal(totalTime, 'typeCategory', aggregateNode.typeCategory)
    this.setDecimal(totalTime, 'party', aggregateNode.mark.get('party'))
    this.rawTotalTime += totalTime
  }

  setDecimal (num, classification, label) {
    const decimalsMap = this.decimals[classification]
    const newValue = decimalsMap.has(label) ? decimalsMap.get(label) + num : num
    decimalsMap.set(label, validateNumber(newValue, `Setting DataSet decimal for ${classification} "${label}"`))
  }

  getDecimal (classification, label) {
    if (!this.decimals[classification].has(label)) return null

    const num = this.decimals[classification].get(label)
    const description = `Getting DataSet decimal for ${classification} "${label}"`
    return (!num || this.rawTotalTime === 0) ? 0 : validateNumber(num / this.rawTotalTime, description)
  }
}

class WallTime {
  constructor (slicesCount) {
    // Creates array of wall time slices, based on typical width of the chart they're to be drawn in, to be scalable
    this.slicesCount = slicesCount
    this.slices = Array.from({ length: this.slicesCount }, () => createWallTimeSlice())

    // Set in callback-event.js AllCallbackEvents.add()
    this.profileStart = 0 // Timestamp of first .init
    this.profileEnd = 0 // Timestamp of last .after

    // Set in callback-event.js AllCallbackEvents.processAll()
    this.profileDuration = null // Number of miliseconds from profileStart to profileEnd
    this.msPerSlice = null // profileDuration / slicesCount, number of miliseconds spanned by each item in slices array

    this.maxAsyncPending = 0
    this.maxSyncActive = 0
    this.categoriesOrdered = []
  }

  getSegments (startTime, endTime, discardFirst = false) {
    const {
      profileStart,
      profileEnd,
      msPerSlice,
      slices
    } = this

    // Don't allow seemingly valid non-failing output from logically invalid input
    if (startTime < profileStart) throw new Error(`Wall time segment start time (${startTime}) precedes profile start time (${profileStart})`)
    if (endTime > profileEnd) throw new Error(`Wall time segment end time (${endTime}) exceeds profile end time (${profileEnd})`)
    if (startTime > endTime) {
      throw new Error(`Wall time segment start time (${startTime}) doesn’t precede segment end time (${endTime})`)
    }

    const startIndex = Math.floor((startTime - profileStart) / msPerSlice)
    const endIndex = Math.ceil((endTime - profileStart) / msPerSlice)
    const segments = slices.slice(startIndex, endIndex)

    // The last item in getSegments(x, y) is always the same as the first in getSegments(y, z)
    // so use discardFirst when needed to avoid duplication in adjacent segments
    return discardFirst ? segments.slice(1) : segments
  }

  processSlices () {
    const maxAsyncByCategory = {}

    for (let i = 0; i < this.slicesCount; i++) {
      const slice = this.slices[i]
      if (slice.syncActive.callbackCount > this.maxSyncActive) this.maxSyncActive = slice.syncActive.callbackCount
      if (slice.asyncPending.callbackCount > this.maxAsyncPending) this.maxAsyncPending = slice.asyncPending.callbackCount

      // Define maxAsyncByCategory[typeCategory] for each type category present and set it to the highest value
      for (const [typeCategory, value] of Object.entries(slice.asyncPending.byTypeCategory)) {
        if (!maxAsyncByCategory[typeCategory] || value > maxAsyncByCategory[typeCategory]) maxAsyncByCategory[typeCategory] = value
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
