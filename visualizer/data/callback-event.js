'use strict'

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (callKey, source) {
    // the sequence of timestamps should be
    // 1. this.delayStart (earliest, i.e. lowest number)
    // 2. this.before (equal or greater than delayStart)
    // 3. this.after (latest, i.e. highest number)

    // Timestamp when this became the next call to this callback
    this.delayStart = callKey === 0 ? source.init : Math.max(source.before[callKey - 1], source.after[callKey - 1])

    // In rare cases, possibly due to a bug in streams or event tracing, .before timestamps may be greater
    // than .after timestamps. If this happens, sort them, warn the user, and provide debug data
    this.inverted = source.before[callKey] > source.after[callKey] ? { beforeAfterKey: callKey, sourceNode: source } : false

    // Timestamp when this callback call begins
    this.before = source[this.inverted ? 'after' : 'before'][callKey]

    // Timestamp when this callback call completes
    this.after = source[this.inverted ? 'before' : 'after'][callKey]

    // delayStart cannot be after before callback
    if (this.delayStart > this.before) {
      this.delayStart = this.before
    }
    this.aggregateNode = source.aggregateNode

    if (source.dataSet.settings.debugMode) {
      this.callKey = callKey
      this.sourceNode = source
    }
  }
}

// These temporary arrays of all CallbackEvents in a DataSet are to be used to calculate stats, then deleted / garbage collected
class AllCallbackEvents {
  constructor (wallTime) {
    this.array = []
    this.wallTime = wallTime // Reference to DataSet.wallTime object
    this.inversionCases = []
  }

  add (callbackEvent) {
    this.array.push(callbackEvent)
    if (!this.wallTime.profileStart || callbackEvent.delayStart < this.wallTime.profileStart) this.wallTime.profileStart = callbackEvent.delayStart
    if (!this.wallTime.profileEnd || callbackEvent.after > this.wallTime.profileEnd) this.wallTime.profileEnd = callbackEvent.after

    if (callbackEvent.inverted) this.inversionCases.push(callbackEvent.inverted)
  }

  applyWallTimes (callbackEvent) {
    const { delayStart, before, after } = callbackEvent

    const asyncSegments = this.wallTime.getSegments(delayStart, before)
    const syncSegments = this.wallTime.getSegments(before, after)

    // Browserified short-ish (few hundred) loops, within very long loop. Order isn't important.
    // For efficiency, use for (var), only check length once, no variables in block, send to ordinary function
    let i
    for (i = asyncSegments.length - 1; i >= 0; i--) {
      setToWallTimeSegment(callbackEvent, asyncSegments[i].asyncPending)
    }

    for (i = syncSegments.length - 1; i >= 0; i--) {
      setToWallTimeSegment(callbackEvent, syncSegments[i].syncActive)
    }
  }

  processAll () {
    if (this.inversionCases.length) console.warn('Profile contains callbackEvents with .before timestamp(s) greater than the corresponding .after timestamp:', this.inversionCases)

    this.wallTime.profileDuration = this.wallTime.profileEnd - this.wallTime.profileStart
    this.wallTime.msPerSlice = this.wallTime.profileDuration / this.wallTime.slicesCount

    const clusterStats = new Map()
    const aggregateStats = new Map()

    this.array.sort((a, b) => b.before - a.before)

    // Optimised for browsers because it runs once for every callback event in the profile
    for (let i = this.array.length - 1; i >= 0; i--) {
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
      overall: new FlattenedIntervals(),
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

    this.node.stats.setOverall(this.intervals.overall.getFlattenedTotal())
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
    for (let i = this.array.length - 1; i >= 0; i--) {
      // ...flattening against this new one as we go, until we hit a gap
      if (!flattenInterval(this.array, i, newInterval)) break
    }
    this.array.push(newInterval)
  }

  getFlattenedTotal () {
    let total = 0
    for (let i = this.array.length - 1; i >= 0; i--) {
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

    clusterStatsItem.intervals.overall.pushAndFlatten(this)
    aggregateStatsItem.intervals.overall.pushAndFlatten(this)
  }

  applySync (clusterStatsItem, aggregateStatsItem) {
    clusterStatsItem.rawTotals.sync += this.getDuration()
    aggregateStatsItem.rawTotals.sync += this.getDuration()

    clusterStatsItem.intervals.sync.pushAndFlatten(this)
    aggregateStatsItem.intervals.sync.pushAndFlatten(this)

    clusterStatsItem.intervals.overall.pushAndFlatten(this)
    aggregateStatsItem.intervals.overall.pushAndFlatten(this)
  }
}

function setToWallTimeSegment (callbackEvent, segmentData) {
  // Number of callbackEvents at a point in time will be the same as the number of asyncIds
  // because by definition there can't be two callbackEvents of the same asyncId at the same time
  segmentData.callbackCount++

  const aggregateId = callbackEvent.aggregateNode.aggregateId
  if (segmentData.byAggregateId[aggregateId]) {
    segmentData.byAggregateId[aggregateId]++
  } else {
    segmentData.byAggregateId[aggregateId] = 1
  }

  const typeCategory = callbackEvent.aggregateNode.typeCategory
  if (segmentData.byTypeCategory[typeCategory]) {
    segmentData.byTypeCategory[typeCategory]++
  } else {
    segmentData.byTypeCategory[typeCategory] = 1
  }
}

function processCallbackEvent (callbackEvent, clusterStats, aggregateStats) {
  const { delayStart, before, after, aggregateNode } = callbackEvent
  const { aggregateId, isBetweenClusters, clusterNode } = aggregateNode

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
