'use strict'

const { CallbackEvent, AllCallbackEvents } = require('./callback-event.js')
const { validateKey, isNumber } = require('./validation.js')
const { Stem } = require('./stems.js')

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
    this.calculateStems()
  }
  getByNodeType (nodeType, nodeId) {
    const typeKeyMapping = {
      SourceNode: 'sourceNodes',
      AggregateNode: 'aggregateNodes',
      ClusterNode: 'clusterNodes'
    }
    validateKey(nodeType, Object.keys(typeKeyMapping))
    if (!isNumber(nodeId)) return null
    return this[typeKeyMapping[nodeType]].get(nodeId)
  }
  calculateFlattenedStats () {
    this.callbackEvents.processAll()
    this.callbackEvents = null
  }
  calculateStems () {
    for (const clusterNode of this.clusterNodes.values()) {
      clusterNode.stem = new Stem(clusterNode)
      for (const aggregateNode of clusterNode.nodes.values()) {
        aggregateNode.stem = new Stem(aggregateNode)
      }
    }
  }
}

class DataNode {
  constructor (dataSet) {
    // Reference to settings on data map
    this.settings = dataSet.settings
    this.dataSet = dataSet

    this._syncStat = 0
    this._asyncBetweenStat = 0
    this._asyncWithinStat = 0

    const node = this
    this.stats = {
      // For nodes whose sourceNodes contain no callbackEvents (.before and .after arrays are empty), these
      // setters are never called so default 0 values are accessed. Such cases are rare but valid, e.g. root
      // TODO: give examples of some of the async_hook types that often have no callbackEvents.
      set sync (num) { node._syncStat = node.validateStat(num, 'stats.sync') },
      get sync () { return node._syncStat },
      async: {
        set between (num) { node._asyncBetweenStat = node.validateStat(num, 'stats.async.between') },
        get between () { return node._asyncBetweenStat },

        set within (num) { node._asyncWithinStat = node.validateStat(num, 'stats.async.within') },
        get within () { return node._asyncWithinStat }
      }
    }

    this.rawTotals = {
      sync: 0,
      async: {
        between: 0,
        within: 0
      }
    }
  }

  get withinValue () { return this._syncStat + this._asyncWithinStat }
  get betweenValue () { return this._asyncBetweenStat }

  getParentNode () {
    return this.dataSet.getByNodeType(this.constructor.name, this.parentId)
  }

  getSameType (nodeId) {
    return this.dataSet.getByNodeType(this.constructor.name, nodeId)
  }

  validateStat (num, statType) {
    if (!isNumber(num)) throw new Error(`Tried to set ${typeof num} "${num}" to ${this.constructor.name} ${this.getId()} ${statType}, should be number`)
    return num
  }
}

class ClusterNode extends DataNode {
  constructor (node, dataSet) {
    super(dataSet)

    this.isRoot = (node.clusterId === 1)

    this.clusterId = node.clusterId
    this.parentClusterId = node.parentClusterId
    this.name = node.name

    this.children = node.children

    this.nodeIds = new Set(node.nodes.map(node => node.aggregateId))

    this.nodes = new Map(
      node.nodes.map((aggregateNode) => [
        aggregateNode.aggregateId,
        new AggregateNode(aggregateNode, this)
      ])
    )
  }
  getId () {
    return this.clusterId
  }
  get parentId () {
    return this.parentClusterId
  }
}

class Mark {
  constructor (mark) {
    this.mark = mark
  }

  get (index) {
    return this.mark[index]
  }
}

class AggregateNode extends DataNode {
  constructor (node, clusterNode) {
    super(clusterNode.dataSet)

    this.isRoot = (node.isRoot || node.aggregateId === 1)

    this.aggregateId = node.aggregateId
    this.parentAggregateId = node.parentAggregateId
    this.children = node.children
    this.clusterNode = clusterNode

    this.mark = new Mark(node.mark)
    this.type = node.type

    this.frames = node.frames.map((frame) => {
      const frameItem = new Frame(frame)
      return {
        formatted: frameItem.format(),
        data: frameItem
      }
    })
    this.sources = node.sources.map((source) => new SourceNode(source, this))

    this.dataSet.aggregateNodes.set(this.aggregateId, this)
  }
  getId () {
    return this.aggregateId
  }
  get parentId () {
    return this.parentAggregateId
  }
}

class Frame {
  constructor (frame) {
    this.functionName = frame.functionName
    this.typeName = frame.typeName
    this.evalOrigin = frame.evalOrigin
    this.fileName = frame.fileName
    this.lineNumber = frame.lineNumber
    this.columnNumber = frame.columnNumber
    this.isEval = frame.isEval
    this.isConstructor = frame.isConstructor
    this.isNative = frame.isNative
    this.isToplevel = frame.isToplevel
  }

  format () {
    // Get name
    let name = this.functionName ? this.functionName : '<anonymous>'
    if (this.isEval) {
      // no change
    } else if (this.isToplevel) {
      // no change
    } else if (this.isConstructor) {
      name = 'new ' + name
    } else if (this.isNative) {
      name = 'native ' + name
    } else {
      name = this.typeName + '.' + name
    }

    // Get position
    let formatted = '    at ' + name
    if (this.isEval) {
      formatted += ' ' + this.evalOrigin
    } else {
      formatted += ' ' + this.fileName
      formatted += ':' + (this.lineNumber > 0 ? this.lineNumber : '')
      formatted += (this.columnNumber > 0 ? ':' + this.columnNumber : '')
    }

    return formatted
  }
}

class SourceNode extends DataNode {
  constructor (source, aggregateNode) {
    super(aggregateNode.dataSet)

    this.asyncId = source.asyncId
    this.parentAsyncId = source.parentAsyncId
    this.triggerAsyncId = source.parentAsyncId
    this.executionAsyncId = source.parentAsyncId

    this.init = source.init
    this.before = source.before
    this.after = source.after
    this.destroy = source.destroy

    this.aggregateNode = aggregateNode

    source.before.forEach((value, callKey) => {
      const callbackEvent = new CallbackEvent(callKey, this)
      this.dataSet.callbackEvents.array.push(callbackEvent)
    })

    this.dataSet.sourceNodes.set(this.asyncId, this)
  }
  getId () {
    return this.asyncId
  }
}

module.exports = {
  DataSet,
  ClusterNode,
  AggregateNode,
  SourceNode
}
