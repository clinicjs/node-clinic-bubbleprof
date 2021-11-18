'use strict'

const test = require('tap').test
const endpoint = require('endpoint')
const startpoint = require('startpoint')
const Frames = require('../analysis/stack-trace/frames.js')
const StackTrace = require('../analysis/stack-trace/stack-trace.js')
const WrapAsStackTrace = require('../analysis/stack-trace/wrap-as-stack-trace.js')

test('Stack Trace - stream wrap', function (t) {
  const input = [{
    asyncId: 1,
    frames: [{
      fileName: 'test.js'
    }]
  }]

  startpoint(input, { objectMode: true })
    .pipe(new WrapAsStackTrace())
    .pipe(endpoint({ objectMode: true }, function (err, output) {
      if (err) return t.error(err)

      t.strictSame(
        output,
        input.map((data) => new StackTrace(data))
      )

      t.strictSame(
        output.map((data) => data.frames),
        input.map((data) => new Frames(data.frames))
      )
      t.end()
    }))
})

test('Stack Trace - toJSON', function (t) {
  const input = {
    asyncId: 1,
    frames: [{
      fileName: 'test.js'
    }]
  }

  t.strictSame(new StackTrace(input).toJSON(), input)
  t.end()
})
