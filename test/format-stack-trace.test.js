'use strict'

const test = require('tap').test
const stackTrace = require('../collect/stack-trace.js')
const StackTraceDecoder = require('../format/stack-trace-decoder.js')
const StackTraceEncoder = require('../format/stack-trace-encoder.js')

function produceExample (asyncId) {
  // produce examples where the number of frames depends on the id.
  // This is to ensure the message length isn't the same for all messages.
  return (function recursive (left) {
    if (left === 0) {
      return {
        asyncId: asyncId,
        frames: stackTrace().map((frame) => Object.assign({}, frame))
      }
    } else {
      return recursive(left - 1)
    }
  })(asyncId)
}

test('format - stack trace - basic encoder-decoder works', function (t) {
  t.plan(2)
  const encoder = new StackTraceEncoder()
  const decoder = new StackTraceDecoder()
  encoder.pipe(decoder)

  const output = []
  decoder.on('data', (example) => output.push(example))

  const input = []
  for (let i = 0; i < 2; i++) {
    const example = produceExample(i)
    encoder.write(example)
    input.push(example)
  }

  decoder.once('end', function () {
    t.strictSame(input, output)
  })

  encoder.on('end', () => {
    t.pass('close emitted')
  })

  encoder.end()
})

test('format - stack trace - partial decoding', function (t) {
  const encoder = new StackTraceEncoder()
  const decoder = new StackTraceDecoder()

  // encode a sample
  const example1 = produceExample(1)
  encoder.write(example1)
  const example1Encoded = encoder.read()

  const example2 = produceExample(2)
  encoder.write(example2)
  const example2Encoded = encoder.read()

  const example3 = produceExample(3)
  encoder.write(example3)
  const example3Encoded = encoder.read()

  const example4 = produceExample(4)
  encoder.write(example4)
  const example4Encoded = encoder.read()

  const example5 = produceExample(5)
  encoder.write(example5)
  const example5Encoded = encoder.read()

  // partial message length
  decoder.write(example1Encoded.slice(0, 1))
  t.equal(decoder.read(), null)

  // message length complete, partial message
  decoder.write(example1Encoded.slice(1, 20))
  t.equal(decoder.read(), null)

  // message complete, next message incomplete
  decoder.write(Buffer.concat([
    example1Encoded.slice(20),
    example2Encoded.slice(0, 30)
  ]))
  t.strictSame(decoder.read(), example1)
  t.equal(decoder.read(), null)

  // ended previuse sample, but a partial remains
  decoder.write(Buffer.concat([
    example2Encoded.slice(30),
    example3Encoded.slice(0, 40)
  ]))
  t.strictSame(decoder.read(), example2)
  t.equal(decoder.read(), null)

  // Ended previuse, no partial remains
  decoder.write(Buffer.concat([
    example3Encoded.slice(40),
    example4Encoded
  ]))
  t.strictSame(decoder.read(), example3)
  t.strictSame(decoder.read(), example4)
  t.equal(decoder.read(), null)

  // No previuse ended
  decoder.write(example5Encoded)
  t.strictSame(decoder.read(), example5)

  // No more data
  t.equal(decoder.read(), null)
  t.end()
})
