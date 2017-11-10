'use strict'

const JoinRawEvents = require('./join-raw-events.js')
const CombineAsSourceNodes = require('./combine-as-source-nodes.js')
const FilterSourceNodes = require('./filter-source-nodes.js')
const CombineAsAggregateNodes = require('./combine-as-aggregate-nodes.js')

function analysis (sourceStreams) {
  const { stackTrace, traceEvents } = sourceStreams

  // Join the two data streams. The streams are read such that the latest
  // asyncId from each stream are approximatly the same. The output data
  // is annotated with the source.
  const result = new JoinRawEvents(stackTrace, traceEvents)
    // combine the joined events into SourceNode's that combines all the data
    // for the same asyncId.
    .pipe(new CombineAsSourceNodes())
    // Remove SourceNode's that don't have a stack trace. No stack trace
    // indicates that the event was filtered in the stack-trace logger.
    .pipe(new FilterSourceNodes())
    // Aggregate SourceNode's that have the same asynchronous path
    .pipe(new CombineAsAggregateNodes())

  return result
}

module.exports = analysis
