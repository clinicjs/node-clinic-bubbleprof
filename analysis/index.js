'use strict'

const stream = require('stream')
const endpoint = require('endpoint')

const SystemInfo = require('./system-info.js')

const WrapAsStackTrace = require('./stack-trace/wrap-as-stack-trace.js')
const WrapAsTraceEvent = require('./trace-event/wrap-as-trace-event.js')
const JoinAsRawEvent = require('./raw-event/join-as-raw-event.js')

const FilterSourceNodes = require('./source/filter-source-nodes.js')
const IdentifySourceNodes = require('./source/identify-source-nodes.js')
const CombineAsSourceNodes = require('./source/combine-as-source-nodes.js')
const RestructureNetSourceNodes = require('./source/restructure-net-source-nodes.js')

const MarkHttpAggregateNodes = require('./aggregate/mark-http-aggregate-nodes.js')
const CombineAsAggregateNodes = require('./aggregate/combine-as-aggregate-nodes.js')
const MarkPartyAggregateNodes = require('./aggregate/mark-party-aggregate-nodes.js')
const MarkModuleAggregateNodes = require('./aggregate/mark-module-aggregate-nodes.js')

const WrapAsBarrierNodes = require('./barrier/wrap-as-barrier-nodes.js')
const MakeExternalBarrierNodes = require('./barrier/make-external-barrier-nodes.js')
const MakeSynchronousBarrierNodes = require('./barrier/make-synchronous-barrier-nodes.js')

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
  const result = new JoinAsRawEvent(
    stackTraceReader.pipe(new WrapAsStackTrace()),
    traceEventReader.pipe(new WrapAsTraceEvent())
  )

  // SourceNode:
  // Combine the joined events into SourceNode's that combines all the data
  // for the same asyncId.
  // * Changing of parent relationship should be done on this later.
  // NOTE: The source node stream can be any order, so be careful about
  //       order assumtions.
    .pipe(new CombineAsSourceNodes())
  // Remove SourceNode's that are not relevant.
    .pipe(new FilterSourceNodes())
  // Restructure net. source nodes and the socket children.
    .pipe(new RestructureNetSourceNodes())
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
  // Mark external node_modules
    .pipe(new MarkModuleAggregateNodes(systemInfo))
  // Mark HTTP server nodes
    .pipe(new MarkHttpAggregateNodes())

  // BarrierNode:
  // Barriers are cut-off points in the aggregated tree. Initialize the tree
  // with BarrierNodes that are just wrappers around AggregateNodes. These can
  // then latter be merged together.
  // Barriers are not clusters, they are constructed later in the pipeline.
  // However, barriers provides a simple datastructure for creating clusters
  // as they only combine direct children. They can be seen as a
  // Finite-State-Machine.
  // * Try to express as much of the clustering logic using barriers.
  // NOTE: BFS ordering is maintained in the BarrierNodes too.
   .pipe(new WrapAsBarrierNodes())
  // Create barriers where the user callSite is the same
   .pipe(new MakeSynchronousBarrierNodes(systemInfo))
  // Create barriers where one goes from user to external, or from external
  // to user. External includes nodecore.
   .pipe(new MakeExternalBarrierNodes(systemInfo))

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
    const systemInfo = new SystemInfo(data[0])

    analysisPipeline(systemInfo, stackTraceReader, traceEventReader)
      .pipe(result)
  }))

  return result
}

module.exports = analysis
