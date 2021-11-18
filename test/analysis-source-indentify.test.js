'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const IdentifySourceNodes = require('../analysis/source/identify-source-nodes.js')
const { FakeSourceNode } = require('./analysis-util')

test('Source Node - indentify', function (t) {
  const sourceNodeHttpParserA = new FakeSourceNode({
    asyncId: 1,
    frames: [{
      fileName: 'should-be-ignored-a.js'
    }],
    type: 'HTTPPARSER',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeHttpParserB = new FakeSourceNode({
    asyncId: 1,
    frames: [{
      fileName: 'should-be-ignored-b.js'
    }],
    type: 'HTTPPARSER',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeNoFramesA = new FakeSourceNode({
    asyncId: 2,
    frames: [],
    type: 'NO_FRAMES_A',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeNoFramesB = new FakeSourceNode({
    asyncId: 2,
    frames: [],
    type: 'NO_FRAMES_B',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeWithFramesA = new FakeSourceNode({
    asyncId: 2,
    frames: [{
      fileName: 'source-1.js'
    }],
    type: 'TYPE_B',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeWithFramesB = new FakeSourceNode({
    asyncId: 2,
    frames: [{
      fileName: 'source-1.js'
    }],
    type: 'TYPE_A',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodeWithFramesC = new FakeSourceNode({
    asyncId: 2,
    frames: [{
      fileName: 'source-2.js'
    }],
    type: 'TYPE_A',
    triggerAsyncId: 0,
    executionAsyncId: 0,
    init: 1,
    destroy: 2
  })

  const sourceNodesInput = [
    sourceNodeHttpParserA, sourceNodeHttpParserB,
    sourceNodeNoFramesA, sourceNodeNoFramesB,
    sourceNodeWithFramesA, sourceNodeWithFramesB, sourceNodeWithFramesC
  ]

  startpoint(sourceNodesInput, { objectMode: true })
    .pipe(new IdentifySourceNodes())
    .pipe(endpoint({ objectMode: true }, function (err, sourceNodesOutput) {
      if (err) return t.error(err)

      for (const sourceNode of sourceNodesOutput) {
        t.equal(typeof sourceNode.identifier, 'string')
        t.ok(sourceNode.identifier.length > 0)
      }

      t.equal(
        sourceNodesOutput[0].identifier, // sourceNodeHttpParserA
        sourceNodesOutput[1].identifier, // sourceNodeHttpParserB
        'HTTPPARSER ignores frames'
      )

      t.not(
        sourceNodesOutput[2].identifier, // sourceNodeNoFramesA
        sourceNodesOutput[3].identifier, // sourceNodeNoFramesB
        'Without frames the type matters'
      )

      t.not(
        sourceNodesOutput[4].identifier, // sourceNodeWithFramesA
        sourceNodesOutput[5].identifier, // sourceNodeWithFramesB
        'With frames the type matters'
      )

      t.not(
        sourceNodesOutput[5].identifier, // sourceNodeWithFramesB
        sourceNodesOutput[6].identifier, // sourceNodeWithFramesC
        'With frames the frames matters'
      )

      t.end()
    }))
})
