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
const HTTPRequestNodes = require('./source/http-request-nodes.js')

const MarkHttpAggregateNodes = require('./aggregate/mark-http-aggregate-nodes.js')
const CombineAsAggregateNodes = require('./aggregate/combine-as-aggregate-nodes.js')
const MarkPartyAggregateNodes = require('./aggregate/mark-party-aggregate-nodes.js')
const MarkModuleAggregateNodes = require('./aggregate/mark-module-aggregate-nodes.js')
const NameAggregateNodes = require('./aggregate/name-aggregate-nodes.js')

const WrapAsBarrierNodes = require('./barrier/wrap-as-barrier-nodes.js')
const MakeExternalBarrierNodes = require('./barrier/make-external-barrier-nodes.js')
const MakeSynchronousBarrierNodes = require('./barrier/make-synchronous-barrier-nodes.js')
const NameBarrierNodes = require('./barrier/name-barrier-nodes.js')

const CombineAsClusterNodes = require('./cluster/combine-as-cluster-nodes.js')
const AnonymiseClusterFrames = require('./cluster/anonymise-cluster-frames.js')

function analysisPipeline (systemInfo, stackTraceReader, traceEventReader, analysisStream) {
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

  // Forward the truncate event so we can handle it in the UI and show a warning
    .on('truncate', () => analysisStream.emit('truncate'))

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
    // Analyse and find http request nodes
    // We pass the stream instance as it populates the analysis digest
    .pipe(new HTTPRequestNodes(analysisStream))

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
    // Name aggregate nodes
    .pipe(new NameAggregateNodes(systemInfo))

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
    // Populates .name for each barrier node with a name corresponding
    // to what the node represents. Fx, nodecore.http.server or external.my-module
    .pipe(new NameBarrierNodes(systemInfo))

    // ClusterNode:
    // BarrierNodes that are not wrappers marks the beginning of a new
    // ClusterNode. BarrierNodes that are just wrappers for an AggregateNode
    // are merged into the same ClusterNode as its parent.
    // * As it is hard to guarantee that certain AggregateNode patterns
    //   will appear in the same cluster, post manipulation will likely involve
    //   all cluster nodes. This makes manipulation rather difficult, so try
    //   and express as much of the clustering logic using BarrierNodes.
    //   If this is not possible, try and create the BarrierNodes such that
    //   the AggregateNode pattern is guaranteed to be in the same cluster.
    // NOTE: BFS ordering is maintained in the ClusterNodes too.
    .pipe(new CombineAsClusterNodes())
    // Anonymise the stacks
    .pipe(new AnonymiseClusterFrames(systemInfo))

  result.pipe(analysisStream)
}

class Analysis extends stream.PassThrough {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.httpRequests = []
    this.runtime = 0
  }

  start (systemInfo, stackTraceReader, traceEventReader) {
    analysisPipeline(systemInfo, stackTraceReader, traceEventReader, this)
  }
}

class Stringify extends stream.Transform {
  constructor (analysis) {
    super({
      writableObjectMode: true,
      readableObjectMode: false
    })

    this._sep = '\n'
    this._analysis = analysis
    this._warnings = []
    this.on('warning', this._onwarning)
    this.push('{"data":[')
  }

  _onwarning (msg) {
    this._warnings.push(msg)
  }

  _transform (data, enc, cb) {
    this.push(this._sep + JSON.stringify(data))
    this._sep = ',\n'
    cb()
  }

  _flush (cb) {
    const httpRequests = JSON.stringify(this._analysis.httpRequests)
    const runtime = JSON.stringify(this._analysis.runtime)
    const warnings = JSON.stringify(this._warnings)
    this.push(`],"httpRequests":${httpRequests},"runtime":${runtime},"warnings":${warnings}}`)
    cb()
  }
}

function analysis (systemInfoReader, stackTraceReader, traceEventReader, opts) {
  const result = new Analysis()

  systemInfoReader.pipe(endpoint({ objectMode: true }, function (err, data) {
    if (err) return result.emit('error', err)
    const systemInfo = new SystemInfo(data[0])
    result.start(systemInfo, stackTraceReader, traceEventReader)
  }))

  const stream = opts && opts.stringify ? result.pipe(new Stringify(result)) : result

  result.on('truncate', () => stream.emit('warning', 'Truncating input data due to memory constraints'))

  return stream
}

module.exports = analysis
