'use strict'

const JoinEvents = require('./join-events.js')
const CollapseEvents = require('./collapse-events.js')
const FilterEvents = require('./filter-events.js')

function analysis (sourceStreams) {
  const { stackTrace, traceEvents } = sourceStreams

  // Join the two data streams. The streams are read such that the latest
  // asyncId from each stream are approximatly the same. The output data
  // is annotated with the source.
  const result = new JoinEvents(stackTrace, traceEvents)
  // Collaps the joined events into SourceNode's that combines all the data
  // for the same asyncId.
    .pipe(new CollapseEvents())
  // Remove SourceNode's that don't have a stack trace. No stack trace
  // indicates that the event was filtered in the stack-trace logger.
    .pipe(new FilterEvents())

  result.on('data', function (data) {
    console.log('> data ', data.asyncId)
  })

  result.on('end', function () {
    console.log('> end ')
  })
}

module.exports = analysis
