'use strict'

const stream = require('stream')
const endpoint = require('endpoint')
const JoinRawEvents = require('./join-raw-events.js')
const CombineAsSourceNodes = require('./source/combine-as-source-nodes.js')
const FilterSourceNodes = require('./source/filter-source-nodes.js')
const ParseTcpSourceNodes = require('./source/parse-tcp-source-nodes.js')
const IdentifySourceNodes = require('./source/identify-source-nodes.js')
const MarkHttpAggregateNodes = require('./aggregate/mark-http-aggregate-nodes.js')
const MarkPartyAggregateNodes = require('./aggregate/mark-party-aggregate-nodes.js')
const CombineAsAggregateNodes = require('./aggregate/combine-as-aggregate-nodes.js')

function analysisPipeline (systemInfo, stackTraceReader, traceEventReader) {
  // Overview:
  // The data progressing changes data structure a few times. The data
  // structures are transformed the following way:
  //
  // RawEvent -> SourceNode -> AggregateNode -> BarrierNode -> ClusterNode

  // RawEvents:
  // Join the two data streams. The streams are read such that the latest
  // asyncId from each stream are approximatly the same. The output data
  // is annotated with the source.
  const result = new JoinRawEvents(stackTraceReader, traceEventReader)

  // SourceNode:
  // Combine the joined events into SourceNode's that combines all the data
  // for the same asyncId.
  // * Changing of parent relationship should be done on this later.
  // NOTE: The source node stream can be any order, so be careful about
  //       order assumtions.
    .pipe(new CombineAsSourceNodes())
  // Remove SourceNode's that are not relevant.
    .pipe(new FilterSourceNodes())
  // Mark and restructure TCP source nodes and the socket children.
    .pipe(new ParseTcpSourceNodes())
  // Key each SourceNode with an identify hash.
    .pipe(new IdentifySourceNodes())

  // AggregateNode:
  // Aggregate SourceNode's that have the same asynchronous path.
  // * Annotation related to the provider type or the stack should be done
  //   one this layer.
  // NOTE: The aggregate node stream is guaranteed to be in BFS order,
  //       use this for your convenience. However, also avoid changing
  //       the order.
    .pipe(new CombineAsAggregateNodes())
  // Mark {1,2,3}-party type
    .pipe(new MarkPartyAggregateNodes(systemInfo))
  // Mark require('net') nodes
    .pipe(new MarkHttpAggregateNodes())

  return result
}

class Analysis extends stream.PassThrough {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
  }
}

function analysis (systemInfoReader, stackTraceReader, traceEventReader) {
  const result = new Analysis()

  systemInfoReader.pipe(endpoint({ objectMode: true }, function (err, data) {
    if (err) return result.emit('error', err)
    const systemInfo = data[0]

    analysisPipeline(systemInfo, stackTraceReader, traceEventReader)
      .pipe(result)
  }))

  return result
}

module.exports = analysis
