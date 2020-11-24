'use strict'

const Frame = require('./frame.js')
const { CallbackEvent } = require('./callback-event.js')
const {
  validateNumber,
  isNumber
} = require('../validation.js')

class DataNode {
  constructor (dataSet) {
    // Reference to settings on data map
    this.settings = dataSet.settings
    this.dataSet = dataSet

    const node = this
    this.stats = {
      // For nodes whose sourceNodes contain no callbackEvents (.before and .after arrays are empty), these
      // stats are not set, so default 0 values are accessed. Such cases are rare but valid, e.g. root
      // TODO: give examples of some of the async_hook types that often have no callbackEvents.

      overall: 0,
      setOverall (num) { node.stats.overall = node.validateStat(num, 'stats.overall') },

      sync: 0,
      setSync (num) { node.stats.sync = node.validateStat(num, 'stats.sync') },

      async: {
        between: 0,
        setBetween (num) { node.stats.async.between = node.validateStat(num, 'stats.async.between') },

        within: 0,
        setWithin (num) { node.stats.async.within = node.validateStat(num, 'stats.async.within') }
      },

      rawTotals: {
        sync: 0,
        async: {
          between: 0,
          within: 0
        }
      }
    }
  }

  getWithinTime () { return this.stats.sync + this.stats.async.within }
  getBetweenTime () { return this.stats.async.between }
  /* istanbul ignore next: currently unused */
  getAsyncTime () { return this.stats.async.between + this.stats.async.within }
  /* istanbul ignore next: currently unused */
  getSyncTime () { return this.stats.sync }
  getTotalTime () { return this.stats.overall }

  getParentNode () {
    return this.dataSet.getByNodeType(this.constructor.name, this.parentId)
  }

  getSameType (nodeId) {
    return this.dataSet.getByNodeType(this.constructor.name, nodeId)
  }

  validateStat (num, statType = '', conditions) {
    const targetDescription = `For ${this.constructor.name} ${this.id}${statType ? ` ${statType}` : ''}`
    return validateNumber(num, targetDescription, conditions)
  }

  static markFromArray (markArray) {
    if (markArray instanceof Map) return markArray
    // node.mark is always an array of length 3, based on this schema:
    const markKeys = ['party', 'module', 'name']
    // 'party' (as in 'third-party') will be one of 'user', 'external' or 'nodecore'.
    // 'module' and 'name' will be null unless frames met conditions in /analysis/aggregate
    const mark = new Map(markArray.map((value, i) => [markKeys[i], value]))
    // for example, 'nodecore.net.onconnection', or 'module.somemodule', or 'user'
    mark.string = markArray.reduce((string, value) => string + (value ? '.' + value : ''))
    return mark
  }
}

class ClusterNode extends DataNode {
  constructor (rawNode, dataSet) {
    super(dataSet)

    const defaultProperties = {
      clusterId: 0,
      parentClusterId: null,
      children: [],
      name: 'miscellaneous',
      mark: null,
      isRoot: false,
      nodes: []
    }
    const node = Object.assign(defaultProperties, rawNode)

    this.isRoot = (node.isRoot || node.clusterId === 1)

    this.clusterId = node.clusterId
    this.uid = 'C' + node.clusterId
    this.parentClusterId = node.parentClusterId
    this.name = node.name

    this.children = node.children

    // These contain decimals referring to the portion of a clusterNode's delay attributable to some label
    this.decimals = {
      type: { between: new Map(), within: new Map() }, // Node async_hook types: 'HTTPPARSER', 'TickObject'...
      // TODO: subTypeCategories stats
      typeCategory: { between: new Map(), within: new Map() }, // Defined in .getAsyncTypeCategories() below
      party: { between: new Map(), within: new Map() } // From .mark - 'user', 'module' or 'nodecore'
    }

    this.nodes = new Map()

    const mark = node.mark || (node.nodes.length ? node.nodes[0].mark : null)
    this.mark = mark ? DataNode.markFromArray(mark) : null
  }

  generateAggregateNodes (nodes) {
    // TODO: if this is done out of sequence, it causes a 1d segment not found error in layout/node-allocation
    // on opening some nodes (usually root node). Should ideally not rely on map order: investigate
    const nodesLength = nodes.length
    for (let i = 0; i < nodesLength; i++) {
      const aggregateNode = new AggregateNode(nodes[i], this)
      aggregateNode.generateSourceNodes(nodes[i].sources)
      this.nodes.set(aggregateNode.aggregateId, aggregateNode)
    }
    this.setDecimal(this.getBetweenTime(), 'party', 'between', this.mark.get('party'))
    this.setDecimal(this.getWithinTime(), 'party', 'within', this.mark.get('party'))
  }

  setDecimal (num, classification, position, label) {
    const decimalsMap = this.decimals[classification][position]
    const newValue = decimalsMap.has(label) ? decimalsMap.get(label) + num : num
    decimalsMap.set(label, this.validateStat(newValue))
  }

  getDecimal (classification, position, label) {
    const raw = this.stats.rawTotals
    const rawTotal = position === 'within' ? raw.async.within + raw.sync : raw.async.between

    const statType = `decimals.${classification}.${position}->${label}`
    const num = this.decimals[classification][position].get(label)

    const decimal = (num === 0 || rawTotal === 0) ? 0 : this.validateStat(num / rawTotal, statType)
    return decimal
  }

  getDecimalLabels (classification, position) {
    return this.decimals[classification][position].keys()
  }

  getDecimalsArray (classification, position) {
    const decimalsArray = []
    for (const label of this.decimals[classification][position].keys()) {
      const decimal = this.getDecimal(classification, position, label)
      decimalsArray.push([label, decimal])
    }
    return decimalsArray
  }

  get id () {
    return this.clusterId
  }

  get parentId () {
    return this.parentClusterId
  }
}

class AggregateNode extends DataNode {
  constructor (rawNode, clusterNode) {
    super(clusterNode.dataSet)

    const defaultProperties = {
      aggregateId: 0,
      parentAggregateId: null,
      children: [],
      frames: [],
      type: 'none',
      mark: ['nodecore', null, null],
      isRoot: false,
      sources: []
    }
    const node = Object.assign(defaultProperties, rawNode)

    this.isRoot = (node.isRoot || node.aggregateId === 1)

    this.aggregateId = node.aggregateId
    this.uid = 'A' + node.aggregateId
    this.parentAggregateId = node.parentAggregateId
    this.children = node.children
    this.clusterNode = clusterNode

    this.isBetweenClusters = clusterNode.parentClusterId && clusterNode.getParentNode().nodes.has(node.parentAggregateId)

    this.frames = node.frames.map((frame) => {
      const frameItem = new Frame(frame)
      const frameWrapper = { data: frameItem }
      frameWrapper.name = frameItem.getName()
      frameWrapper.formatted = frameItem.getFormatted(frameWrapper.name)
      return frameWrapper
    })
    this.name = rawNode.name || (this.frames.length ? this.frames[0].name : (this.isRoot ? 'root' : 'empty frames'))

    this.mark = DataNode.markFromArray(node.mark)
    this.party = this.mark.get('party')

    // Node's async_hook types - see https://nodejs.org/api/async_hooks.html#async_hooks_type
    // 29 possible values defined in node core, plus other user-defined values can exist
    this.type = node.type
    const [typeCategory, typeSubCategory] = AggregateNode.getAsyncTypeCategories(this.type)
    this.typeCategory = typeCategory
    this.typeSubCategory = typeSubCategory

    this.dataSet.aggregateNodes.set(this.aggregateId, this)
  }

  generateSourceNodes (sources) {
    const debugMode = this.dataSet.settings.debugMode

    // This loop runs thousands+ times, unbounded and scales with size of profile. Optimize for browsers
    const sourcesLength = sources.length
    // Only store sourceNodes in debugMode, otherwise extract their callbackEvents and discard
    if (debugMode) this.sources = new Array(sourcesLength)

    for (let i = 0; i < sourcesLength; i++) {
      const sourceNode = new SourceNode(sources[i], this)
      sourceNode.generateCallbackEvents()
      if (debugMode) this.sources[i] = sourceNode
    }
    if (debugMode) this.dataSet.sourceNodes = this.dataSet.sourceNodes.concat(this.sources)
  }

  applyDecimalsToCluster () {
    const apply = (time, betweenOrWithin) => {
      this.clusterNode.setDecimal(time, 'type', betweenOrWithin, this.type)
      this.clusterNode.setDecimal(time, 'typeCategory', betweenOrWithin, this.typeCategory)
      this.clusterNode.setDecimal(time, 'party', betweenOrWithin, this.mark.get('party'))
    }
    if (this.isBetweenClusters) {
      apply(this.stats.rawTotals.async.between, 'between')
      apply(this.stats.rawTotals.sync, 'within')
    } else {
      apply(this.stats.rawTotals.async.between + this.stats.rawTotals.sync, 'within')
    }
  }

  getDecimalsArray (classification, position) {
    return [[this[classification], 1]]
  }

  get id () {
    return this.aggregateId
  }

  get parentId () {
    return this.parentAggregateId
  }

  static getAsyncTypeCategories (typeName) {
  // Combines node's async_hook types into sets of more user-friendly thematic categories
  // Based on https://gist.github.com/mafintosh/e31eb1d61f126de019cc10344bdbb62b
    switch (typeName) {
      case 'FSEVENTWRAP':
      case 'FSREQWRAP':
      case 'STATWATCHER':
        return ['files-streams', 'fs']
      case 'JSSTREAM':
      case 'WRITEWRAP':
      case 'SHUTDOWNWRAP':
        return ['files-streams', 'streams']
      case 'ZLIB':
        return ['files-streams', 'zlib']

      case 'HTTPPARSER':
      case 'PIPECONNECTWRAP':
      case 'PIPEWRAP':
      case 'TCPCONNECTWRAP':
      case 'TCPSERVER':
      case 'TCPWRAP':
      case 'TCPSERVERWRAP':
        return ['networks', 'networking']
      case 'UDPSENDWRAP':
      case 'UDPWRAP':
        return ['networks', 'network']
      case 'GETADDRINFOREQWRAP':
      case 'GETNAMEINFOREQWRAP':
      case 'QUERYWRAP':
        return ['networks', 'dns']

      case 'PBKDF2REQUEST':
      case 'RANDOMBYTESREQUEST':
      case 'TLSWRAP':
      case 'SSLCONNECTION':
        return ['crypto', 'crypto']

      case 'TIMERWRAP':
      case 'Timeout':
      case 'Immediate':
      case 'TickObject':
        return ['timing-promises', 'timers-and-ticks']
      case 'PROMISE':
        return ['timing-promises', 'promises']

      case 'PROCESSWRAP':
      case 'TTYWRAP':
      case 'SIGNALWRAP':
        return ['other', 'process']
      case 'none':
        return ['other', 'root']
      default:
        return ['other', 'user-defined']
    }
  }
}

class SourceNode {
  constructor (rawSource, aggregateNode) {
    this.dataSet = aggregateNode.dataSet
    this.dataSet.sourceNodesCount++

    const defaultProperties = {
      asyncId: 0,
      parentAsyncId: null,
      children: [],
      init: null,
      before: [],
      after: [],
      destroy: null
    }
    const source = Object.assign(defaultProperties, rawSource)

    this.asyncId = source.asyncId
    this.parentAsyncId = source.parentAsyncId
    this.triggerAsyncId = source.parentAsyncId
    this.executionAsyncId = source.parentAsyncId

    this.init = source.init // numeric timestamp

    // In rare cases, possibly due to a bug in streams or event tracing, arrays of .before and .after
    // times are out of sequence. If this happens, sort them, warn the user, and provide debug data
    const scrambledOrder = source.before.some((value, index) => index && value < source.before[index - 1])

    this.before = scrambledOrder ? source.before.sort() : source.before // array of numeric timestamps
    this.after = scrambledOrder ? source.after.sort() : source.after // array of numeric timestamps
    this.destroy = source.destroy // numeric timestamp

    if (scrambledOrder) console.warn('The following async ID source data contained out-of-sequence .before and .after timestamps:', source)

    this.aggregateNode = aggregateNode
  }

  generateCallbackEvents () {
    // Skip unusual cases of a broken asyncId with no init time (e.g. some root nodes)
    if (!isNumber(this.init)) return this

    // This loop runs thousands+++ of times, unbounded and scales with size of profile. Optimize for browsers
    const callbackEventCount = this.before.length
    for (let i = 0; i < callbackEventCount; i++) {
      // Skip incomplete items, e.g. bad application exits leaving a .before with no corresponding .after
      if (isNumber(this.after[i])) this.dataSet.callbackEvents.add(new CallbackEvent(i, this))
    }
    return this
  }

  get id () {
    return this.asyncId
  }
}

// ArticificalNodes are created in /layout/ for layout-specific combinations or modified versions of nodes
class ArtificialNode extends ClusterNode {
  constructor (rawNode, nodeToCopy, contents) {
    const nodeProperties = Object.assign({}, nodeToCopy, rawNode, {
      clusterId: rawNode.id || nodeToCopy.id,
      parentClusterId: rawNode.parentId || nodeToCopy.parentId,
      nodes: []
    })
    super(nodeProperties, nodeToCopy.dataSet)

    const defaultProperties = {
      nodeType: 'AggregateNode'
    }
    const node = Object.assign(defaultProperties, rawNode)
    if (nodeToCopy.clusterNode) {
      this.clusterNode = nodeToCopy.clusterNode
    }

    this.nodeType = node.nodeType
    this.uid = rawNode.id
    this.contents = contents
  }

  applyAggregateNodes (nodes) {
    if (!nodes.size) return

    for (const [aggregateId, aggregateNode] of nodes) {
      this.nodes.set(aggregateId, aggregateNode)
      if (!this.mark) this.mark = aggregateNode.mark
    }
  }

  getSameType (nodeId) {
    return this.dataSet.getByNodeType(this.nodeType, nodeId)
  }

  aggregateStats (dataNode) {
    this.stats.setOverall(this.stats.overall + dataNode.stats.overall)
    this.stats.setSync(this.stats.sync + dataNode.stats.sync)
    this.stats.async.setWithin(this.stats.async.within + dataNode.stats.async.within)
    this.stats.async.setBetween(this.stats.async.between + dataNode.stats.async.between)

    this.stats.rawTotals.sync += dataNode.stats.rawTotals.sync
    this.stats.rawTotals.async.between += dataNode.stats.rawTotals.async.between
    this.stats.rawTotals.async.within += dataNode.stats.rawTotals.async.within
  }

  aggregateDecimals (dataNode, classification, position) {
    if (dataNode.decimals) {
      // e.g. combining clusterNodes
      const byLabel = dataNode.decimals[classification][position]
      for (const [label, value] of byLabel) {
        this.setDecimal(value, classification, position, label)
      }
    } else {
      // e.g. combining aggregateNodes
      const label = dataNode[classification]
      const rawTotals = dataNode.stats.rawTotals
      const value = rawTotals.async[position] + (position === 'within' ? rawTotals.sync : 0)
      this.setDecimal(value, classification, position, label)
    }
  }
}

class ShortcutNode extends ArtificialNode {
  constructor (rawNode, nodeToCopy) {
    super(rawNode, nodeToCopy)
    this.shortcutTo = nodeToCopy
  }
}

module.exports = {
  ShortcutNode,
  ArtificialNode,
  ClusterNode,
  AggregateNode,
  SourceNode,
  DataNode
}
