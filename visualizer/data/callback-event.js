'use strict'

const { areNumbers } = require('./validation.js')

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (callKey, source) {
    const dataSet = source.dataSet

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
    this.isBetweenClusters = parentAggregateId && !this.clusterNode.nodeIds.has(parentAggregateId)

    dataSet.callbackEventsArray.push(this)
  }
}

// These temporary arrays of all CallbackEvents in a DataSet are to be used to calculate stats, then deleted / garbage collected
class CallbackEventsArray extends Array {
  processAll () {
    const clusterStats = new Map()
    const aggregateStats = new Map()

    this.sort((a, b) => a.before - b.before)

    for (const callbackEvent of this) {
      const { delayStart, before, after, isBetweenClusters, aggregateNode, clusterNode } = callbackEvent

      if (!areNumbers([delayStart, before, after])) {
        // Skip items with missing data, e.g. root or bad application exits leaving .before but no .after
        continue
      }

      const aggregateId = aggregateNode.id
      if (!aggregateStats.has(aggregateId)) aggregateStats.set(aggregateId, new TemporaryStatsItem(aggregateNode))
      const aggregateStatsItem = aggregateStats.get(aggregateId)

      const clusterId = clusterNode.id
      if (!clusterStats.has(clusterId)) clusterStats.set(clusterId, new TemporaryStatsItem(clusterNode))
      const clusterStatsItem = clusterStats.get(clusterId)

      const asyncInterval = new Interval(delayStart, before, isBetweenClusters)
      asyncInterval.applyAsync(clusterStatsItem, aggregateStatsItem, isBetweenClusters)

      const syncInterval = new Interval(before, after, isBetweenClusters)
      syncInterval.applySync(clusterStatsItem, aggregateStatsItem, isBetweenClusters)
    }

    clusterStats.forEach(item => item.applyIntervalsTotals())
    aggregateStats.forEach(item => item.applyIntervalsTotals())
  }
}

class TemporaryStatsItem {
  constructor (node) {
    this.intervals = {
      sync: new IntervalsArray(),
      async: {
        between: new IntervalsArray(),
        within: new IntervalsArray()
      }
    }
    this.rawTotals = {
      sync: 0,
      async: {
        between: 0,
        within: 0
      }
    }
    this.node = node
  }
  applyIntervalsTotals () {
    const statsTarget = this.node.stats

    statsTarget.rawTotals = this.rawTotals

    statsTarget.sync = this.intervals.sync.getFlattenedTotal()
    statsTarget.async.between = this.intervals.async.between.getFlattenedTotal()
    statsTarget.async.within = this.intervals.async.within.getFlattenedTotal()
    delete this.intervals
  }
}

class IntervalsArray extends Array {
  pushAndFlatten (interval) {
    // Clone interval data to mutate it without cross-referencing between cluster and aggregate
    const newInterval = new Interval(interval.start, interval.end, interval.isBetween)

    // If we've already found intervals for this node, walk backwards through them,
    // flattening against this new one as we go, until we hit a gap
    for (var i = this.length - 1; i >= 0; i--) {
      const earlierInterval = this[i]

      if (newInterval.start < earlierInterval.end) {
        this.pop()
        newInterval.start = Math.min(earlierInterval.start, newInterval.start)
        newInterval.end = Math.max(earlierInterval.end, newInterval.end)
      } else {
        // Can't be any more before this point
        break
      }
    }
    this.push(newInterval)
  }
  getFlattenedTotal () {
    let total = 0
    for (const interval of this) {
      total += interval.duration
    }
    return total
  }
}

class Interval {
  constructor (start, end, isBetween) {
    this.start = start
    this.end = end
    this.isBetween = isBetween
  }
  get clusterDataType () {
    return this.isBetween ? 'between' : 'within'
  }
  get duration () {
    return this.end - this.start
  }
  applyAsync (clusterStatsItem, aggregateStatsItem) {
    clusterStatsItem.rawTotals.async[this.clusterDataType] += this.duration
    aggregateStatsItem.rawTotals.async.between += this.duration

    clusterStatsItem.intervals.async[this.clusterDataType].pushAndFlatten(this)
    aggregateStatsItem.intervals.async.between.pushAndFlatten(this)
  }
  applySync (clusterStatsItem, aggregateStatsItem) {
    clusterStatsItem.rawTotals.sync += this.duration
    aggregateStatsItem.rawTotals.sync += this.duration

    clusterStatsItem.intervals.sync.pushAndFlatten(this)
    aggregateStatsItem.intervals.sync.pushAndFlatten(this)
  }
}

module.exports = {
  CallbackEvent,
  CallbackEventsArray
}
