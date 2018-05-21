'use strict'

const { areNumbers } = require('../validation.js')

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (callKey, source) {
    // Timestamp when this became the next call to this callback
    this.delayStart = callKey === 0 ? source.init : source.after[callKey - 1]

    // Timestamp when this callback call begins
    this.before = source.before[callKey]

    // Timestamp when this callback call completes
    this.after = source.after[callKey]

    this.sourceNode = source
    this.aggregateNode = source.aggregateNode
    this.clusterNode = source.aggregateNode.clusterNode

    this.isBetweenClusters = this.aggregateNode.isBetweenClusters
  }
}

// These temporary arrays of all CallbackEvents in a DataSet are to be used to calculate stats, then deleted / garbage collected
class AllCallbackEvents {
  constructor (wallTime) {
    this.array = []
    this.wallTime = wallTime // Reference to DataSet.wallTime object
  }

  add (callbackEvent) {
    // Skip items with missing data, e.g. root or bad application exits leaving .before but no .after
    const {
      delayStart,
      before,
      after
    } = callbackEvent

    if (!areNumbers([delayStart, before, after])) return

    this.array.push(callbackEvent)
    if (!this.wallTime.profileStart || delayStart < this.wallTime.profileStart) this.wallTime.profileStart = delayStart
    if (!this.wallTime.profileEnd || after > this.wallTime.profileEnd) this.wallTime.profileEnd = after
  }

  applyWallTimes (callbackEvent) {
    const { delayStart, before, after } = callbackEvent

    const asyncSegments = this.wallTime.getSegments(delayStart, before)
    const syncSegments = this.wallTime.getSegments(before, after)

    // Browserified short-ish (<100) loops, within very long loop. Order isn't important.
    // For efficiency, use for (var), only check length once, no variables in block, send to ordinary function
    var i
    for (i = asyncSegments.length - 1; i >= 0; i--) {
      setToWallTimeSegment(callbackEvent, asyncSegments[i].asyncPending)
    }

    for (i = syncSegments.length - 1; i >= 0; i--) {
      setToWallTimeSegment(callbackEvent, syncSegments[i].syncActive)
    }
  }

  processAll () {
    this.wallTime.profileDuration = this.wallTime.profileEnd - this.wallTime.profileStart
    this.wallTime.msPerPercent = this.wallTime.profileDuration / 100

    const clusterStats = new Map()
    const aggregateStats = new Map()

    this.array.sort((a, b) => b.before - a.before)

    // Optimised for browsers because it runs once for every callback event in the profile
    for (var i = this.array.length - 1; i >= 0; i--) {
      this.applyWallTimes(this.array[i])
      processCallbackEvent(this.array[i], clusterStats, aggregateStats)
    }

    clusterStats.forEach(item => item.applyIntervalsTotals())
    aggregateStats.forEach(item => item.applyIntervalsTotals())
  }
}

class TemporaryStatsItem {
  constructor (node) {
    this.intervals = {
      sync: new FlattenedIntervals(),
      async: {
        between: new FlattenedIntervals(),
        within: new FlattenedIntervals()
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
    this.node.stats.rawTotals = this.rawTotals

    this.node.stats.setSync(this.intervals.sync.getFlattenedTotal())
    this.node.stats.async.setBetween(this.intervals.async.between.getFlattenedTotal())
    this.node.stats.async.setWithin(this.intervals.async.within.getFlattenedTotal())
    this.intervals = null
  }
}

class FlattenedIntervals {
  constructor () {
    this.array = []
  }
  pushAndFlatten (interval) {
    // Clone interval data to mutate it without cross-referencing between cluster and aggregate
    const newInterval = new Interval(interval.start, interval.end, interval.isBetween)

    // If we've already found intervals for this node, walk backwards through them...
    for (var i = this.array.length - 1; i >= 0; i--) {
      // ...flattening against this new one as we go, until we hit a gap
      if (!flattenInterval(this.array, i, newInterval)) break
    }
    this.array.push(newInterval)
  }
  getFlattenedTotal () {
    let total = 0
    for (var i = this.array.length - 1; i >= 0; i--) {
      total += this.array[i].getDuration()
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
  getClusterDataType () {
    return this.isBetween ? 'between' : 'within'
  }
  getDuration () {
    return this.end - this.start
  }
  applyAsync (clusterStatsItem, aggregateStatsItem) {
    clusterStatsItem.rawTotals.async[this.getClusterDataType()] += this.getDuration()
    aggregateStatsItem.rawTotals.async.between += this.getDuration()

    clusterStatsItem.intervals.async[this.getClusterDataType()].pushAndFlatten(this)
    aggregateStatsItem.intervals.async.between.pushAndFlatten(this)
  }
  applySync (clusterStatsItem, aggregateStatsItem) {
    clusterStatsItem.rawTotals.sync += this.getDuration()
    aggregateStatsItem.rawTotals.sync += this.getDuration()

    clusterStatsItem.intervals.sync.pushAndFlatten(this)
    aggregateStatsItem.intervals.sync.pushAndFlatten(this)
  }
}

function setToWallTimeSegment (callbackEvent, segmentData) {
  // Number of callbackEvents at a point in time will be the same as the number of asyncIds
  // because by definition there can't be two callbackEvents of the same asyncId at the same time
  segmentData.callbackCount++
  segmentData.aggregateNodes.add(callbackEvent.aggregateNode.aggregateId)
}

function processCallbackEvent (callbackEvent, clusterStats, aggregateStats) {
  const { delayStart, before, after, isBetweenClusters, aggregateNode, clusterNode } = callbackEvent

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

function flattenInterval (intervalsArray, i, newInterval) {
  const earlierInterval = intervalsArray[i]

  if (newInterval.start < earlierInterval.end) {
    intervalsArray.pop()
    newInterval.start = Math.min(earlierInterval.start, newInterval.start)
    newInterval.end = Math.max(earlierInterval.end, newInterval.end)
    return true
  }
  // Can't be any more after this point, so break the for loop
  return false
}

module.exports = {
  CallbackEvent,
  AllCallbackEvents
}
