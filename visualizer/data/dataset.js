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

    // Array of CallbackEvents is temporary for calculating stats on other nodes
    this.callbackEvents = new AllCallbackEvents() // CallbackEvents are created and pushed within SourceNode constructor
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

module.exports = DataSet
