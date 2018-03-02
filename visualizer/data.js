'use strict'

const data = require('./data.json') // base64 encoded source file

// 'data = data' optional arg allows json to be passed in for browserless tests
function loaddata (callback, json = data) {
  setTimeout(function () {
    callback(null, wrapData(json))
  })
}
module.exports = loaddata

function wrapData (data) {
  return new Map(
    data.map((node) => [node.clusterId, new ClusterNode(node)])
  )
}

class ClusterNode {
  constructor (node) {
    this.isRoot = (node.clusterId === 1)

    this.clusterId = node.clusterId
    this.parentClusterId = node.parentClusterId
    this.name = node.name

    this.children = node.children
    this.nodes = node.nodes
      .map((aggregateNode) => new AggregateNode(aggregateNode))
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

class AggregateNode {
  constructor (node) {
    this.isRoot = (node.aggregateId === 1)

    this.aggregateId = node.aggregateId
    this.parentAggregateId = node.parentAggregateId
    this.children = node.children

    this.mark = new Mark(node.mark)
    this.type = node.type

    this.frames = node.frames.map((frame) => new Frame(frame))
    this.sources = node.sources.map((source) => new SourceNode(source))
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

class SourceNode {
  constructor (source) {
    this.asyncId = source.asyncId
    this.parentAsyncId = source.parentAsyncId
    this.triggerAsyncId = source.parentAsyncId
    this.executionAsyncId = source.parentAsyncId

    this.init = source.init
    this.before = source.before
    this.after = source.after
    this.destroy = source.destroy

    this.callbackEvents = source.before.map((value, callKey) => new CallbackEvent(source, callKey))
  }
}

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (source, callKey) {
    // Timestamp when this became the next call to this callback
    this.delayStart = callKey === 0 ? source.init : source.after[callKey - 1]

    // Timestamp when this callback call begins
    this.before = source.before[callKey]

    // Timestamp when this callback call completes
    this.after = source.after[callKey]

    this.syncTime = this.after - this.before
    this.rawDelay = this.before - this.delayStart
    this.adjustedDelays = new Map()

    this.source = source
  }
}
