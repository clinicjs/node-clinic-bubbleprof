'use strict'

const JoinRawEvents = require('./join-raw-events.js')
const CombineAsSourceNodes = require('./combine-as-source-nodes.js')
const FilterSourceNodes = require('./filter-source-nodes.js')
const ParseTcpSourceNodes = require('./parse-tcp-source-nodes.js')
const IdentifySourceNodes = require('./identify-source-nodes.js')
const CombineAsAggregateNodes = require('./combine-as-aggregate-nodes.js')

function analysis (stackTraceReader, traceEventsReader) {
  // Join the two data streams. The streams are read such that the latest
  // asyncId from each stream are approximatly the same. The output data
  // is annotated with the source.
  const result = new JoinRawEvents(stackTraceReader, traceEventsReader)
    // combine the joined events into SourceNode's that combines all the data
    // for the same asyncId.
    .pipe(new CombineAsSourceNodes())
    // Remove SourceNode's that are not relevant.
    .pipe(new FilterSourceNodes())
    // Mark and restructure TCP source nodes and the socket children.
    .pipe(new ParseTcpSourceNodes())
    // Key each SourceNode with an identify hash.
    .pipe(new IdentifySourceNodes())
    // Aggregate SourceNode's that have the same asynchronous path
    .pipe(new CombineAsAggregateNodes())

  return result
}

module.exports = analysis
