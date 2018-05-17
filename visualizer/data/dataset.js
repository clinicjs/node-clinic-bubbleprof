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
      averaging: 'mean', // to be applied to callbackEvents within a sourceNode
      quantileRange: 99, // set null to keep all outliers
      idleOnly: false // if true, discounts async delays while sync process blocks event loop
    }

    settings = Object.assign(defaultSettings, settings)
    validateKey(settings.averaging, ['mean', 'median', 'sum'])
    this.settings = settings

    this.wallTime = {
      // Creates array of 100 wall time segments, one for each 1% segment of the total running time
      percentSlices: Array.from({length: 100}, () => getWallTimeSegment()),

      // Set in callback-event.js AllCallbackEvents.add()
      profileStart: 0, // Timestamp of first .init
      profileEnd: 0, // Timestamp of last .after

      // Set in callback-event.js AllCallbackEvents.processAll()
      profileDuration: null, // Number of miliseconds from profileStart to profileEnd
      msPerPercent: null // profileDuration / 100, number of miliseconds spanned by each item in percentages array
    }

    // Array of CallbackEvents is temporary for calculating stats on other nodes
    this.callbackEvents = new AllCallbackEvents(this.wallTime) // CallbackEvents are created and pushed within SourceNode constructor
    // Source, Aggregate and Cluster Node maps persist in memory throughout
    this.sourceNodes = new Map() // SourceNodes are created from AggregateNode constructor and set in their own constructor
    this.aggregateNodes = new Map() // AggregateNodes are created from ClusterNode constructor and set in their own constructor
    this.clusterNodes = new Map(
      data.map((node) => [node.clusterId, new ClusterNode(node, this)])
    )
  }
  processData () {
    this.calculateFlattenedStats()
    this.calculateDecimals()
  }
  getByNodeType (nodeType, nodeId) {
    const typeKeyMapping = {
      SourceNode: 'sourceNodes',
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

function getWallTimeSegment () {
  // Refers to 1% of the time the profile was running for
  return {
    syncActive: {
      asyncIds: new Set(),
      callbackCount: 0,
      aggregateNodes: new Set()
    },
    asyncPending: {
      asyncIds: new Set(),
      callbackCount: 0,
      aggregateNodes: new Set()
    }
  }
}

module.exports = DataSet
