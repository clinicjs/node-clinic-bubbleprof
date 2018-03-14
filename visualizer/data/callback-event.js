'use strict'

const allCallbackEvents = []

function isNumber (num) {
  return typeof num === 'number' && !Number.isNaN(num)
}
function areNumbers (arr) {
  let result = !!arr.length
  arr.forEach((num) => { if (!isNumber(num)) result = false })
  return result
}

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (source, callKey) {
    this.settings = source.settings

    this.sourceNode = source

    // Timestamp when this became the next call to this callback
    this.delayStart = callKey === 0 ? source.init : source.after[callKey - 1]

    // Timestamp when this callback call begins
    this.before = source.before[callKey]

    // Timestamp when this callback call completes
    this.after = source.after[callKey]

    this.aggregateNode = this.sourceNode.aggregateNode
    this.clusterNode = this.sourceNode.aggregateNode.clusterNode

    const parentAggregateId = this.aggregateNode.parentAggregateId
    this.isBetweenClusters = this.clusterNode.nodes && parentAggregateId && !this.clusterNode.nodeIds.has(parentAggregateId)

    allCallbackEvents.push(this)
  }

  static processAllCallbackEvents () {
    // Keep functions accessing allCallbackEvents array outside instances, so it can be
    // more easily garbage collected while instances of CallbackEvent stay in memory
    flattenOverlapingIntervals()
    // TODO: For each type of node, work out this callback's contribution as a percentage of the raw total
    // TODO: Apply averages
  }
}

function flattenOverlapingIntervals () {
  const clusterStats = new Map()
  const aggregateStats = new Map()

  allCallbackEvents.sort((a, b) => a.before - b.before)

  for (let i = 0; i < allCallbackEvents.length; i++) {
    const callbackEvent = allCallbackEvents[i]

    if (!areNumbers([callbackEvent.delayStart, callbackEvent.before, callbackEvent.after])) {
      // Skip items with missing data, e.g. root nodes or bad application exits leaving .before but no .after
      continue
    }

    const aggregateId = callbackEvent.aggregateNode.id
    if (!aggregateStats.has(aggregateId)) addStatsItem(aggregateStats, callbackEvent.aggregateNode)
    const aggregateStatsItem = aggregateStats.get(aggregateId)

    const clusterId = callbackEvent.clusterNode.id
    if (!clusterStats.has(clusterId)) addStatsItem(clusterStats, callbackEvent.clusterNode)
    const clusterStatsItem = clusterStats.get(clusterId)

    const asyncInterval = {
      start: callbackEvent.delayStart,
      end: callbackEvent.before
    }
    applyInterval(asyncInterval, clusterStatsItem, aggregateStatsItem, callbackEvent.isBetweenClusters, true)

    const syncInterval = {
      start: callbackEvent.before,
      end: callbackEvent.after
    }
    applyInterval(syncInterval, clusterStatsItem, aggregateStatsItem, callbackEvent.isBetweenClusters, false)
  }

  applyIntervalsTotals(clusterStats)
  applyIntervalsTotals(aggregateStats)
}

function addStatsItem (stats, node) {
  stats.set(node.id, {
    intervals: {
      sync: [],
      async: {
        between: [],
        within: []
      }
    },
    rawTotals: {
      sync: 0,
      async: {
        between: 0,
        within: 0
      }
    },
    node
  })
}

function applyInterval (interval, clusterStatsItem, aggregateStatsItem, isBetween = false, isAsync = false) {
  const duration = interval.end - interval.start
  const clusterDataType = isBetween ? 'between' : 'within'

  if (isAsync) {
    clusterStatsItem.rawTotals.async[clusterDataType] += duration
    aggregateStatsItem.rawTotals.async.between += duration
    flattenInterval(interval, clusterStatsItem.intervals.async[clusterDataType])
    flattenInterval(interval, aggregateStatsItem.intervals.async.between)
  } else {
    clusterStatsItem.rawTotals.sync += duration
    aggregateStatsItem.rawTotals.sync += duration
    flattenInterval(interval, clusterStatsItem.intervals.sync)
    flattenInterval(interval, aggregateStatsItem.intervals.sync)
  }
}

function flattenInterval (interval, intervals) {
  // Clone interval data so we can mutate it without causing cross-referencing problems
  // Can't use {...interval} spread operator because fails acorn.js parser
  let newInterval = Object.assign({}, interval)

  // If we've already found intervals for this node, walk backwards through them,
  // flattening against this new one as we go, until we hit a gap
  for (var i = intervals.length - 1; i >= 0; i--) {
    const earlierInterval = intervals[i]

    if (newInterval.start < earlierInterval.end) {
      intervals.pop()
      newInterval.start = Math.min(earlierInterval.start, newInterval.start)
      newInterval.end = Math.max(earlierInterval.end, newInterval.end)
    } else {
      // Can't be any more before this point
      break
    }
  }
  intervals.push(newInterval)
}

function applyIntervalsTotals (stats) {
  for (const [, statsItem] of stats) {
    const nodeStats = statsItem.node.stats

    nodeStats.rawTotals = statsItem.rawTotals

    nodeStats.sync = getFlattenedTotal(statsItem.intervals.sync)
    nodeStats.async.between = getFlattenedTotal(statsItem.intervals.async.between)
    nodeStats.async.within = getFlattenedTotal(statsItem.intervals.async.within)
    delete statsItem.intervals
  }
}

function getFlattenedTotal (intervals) {
  let total = 0
  for (const interval of intervals) {
    total += interval.end - interval.start
  }
  return total
}

module.exports = CallbackEvent
