'use strict'

const CallbackEvent = require('./callback-event.js')

function isNumber (num) {
  return typeof num === 'number' && !Number.isNaN(num)
}

function validateKey (key, validOptions) {
  if (typeof key !== 'string' || validOptions.indexOf(key) === -1) {
    throw new Error(`Invalid key "${key}" passed, valid types are: ${validOptions.join(', ')}`)
  }
}

function wrapData (data, settings = {}) {
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

  const dataWrap = new Map(
    data.map((node) => [node.clusterId, new ClusterNode(node, settings)])
  )
  CallbackEvent.processAllCallbackEvents(dataWrap)

  dataWrap.settings = settings

  return dataWrap
}

class DataNode {
  constructor (settings) {
    // Reference to settings on data map
    this.settings = settings

    this.stats = new Map()
    this.stats.set(this.settings.averaging, {
      between: 0,
      within: 0
    })

    // Pre-averaging stats based on removing node-specific overlaps only
    Object.assign(this.stats, {
      sync: 0,
      async: {
        between: 0,
        within: 0
      }
    })

    this.rawTotals = {
      sync: 0,
      async: {
        between: 0,
        within: 0
      }
    }
  }
  getStat (statType) {
    validateKey(statType, ['within', 'between'])

    const stat = this.stats.get(this.settings.averaging)[statType]
    if (!isNumber(stat)) {
      const statLabel = `${this.settings.averaging}.${statType}`
      const nodeLabel = `${this.prototype.constructor} ${this.id}`
      throw new Error(`Stat ${statLabel} of ${nodeLabel} is not a number: is ${stat}, typeof ${typeof stat}`)
    }
    return stat
  }
  setStat (statType) {
    // TODO.
    // Define most of this logic in a setStat method on each class, which uses
    // super to share logic that can be shared
  }
}

class ClusterNode extends DataNode {
  constructor (node, settings) {
    super(settings)

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
  get id () {
    return this.clusterId
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
    super(clusterNode.settings)

    this.isRoot = (node.aggregateId === 1)

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
  }
  get id () {
    return this.aggregateId
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
    super(aggregateNode.settings)

    this.asyncId = source.asyncId
    this.parentAsyncId = source.parentAsyncId
    this.triggerAsyncId = source.parentAsyncId
    this.executionAsyncId = source.parentAsyncId

    this.init = source.init
    this.before = source.before
    this.after = source.after
    this.destroy = source.destroy

    this.aggregateNode = aggregateNode

    this.callbackEvents = source.before.map((value, callKey) => new CallbackEvent(this, callKey))
  }
  get id () {
    return this.asyncId
  }
}

module.exports = {
  wrapData,
  ClusterNode,
  AggregateNode,
  SourceNode
}
