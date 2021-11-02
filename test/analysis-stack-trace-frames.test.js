'use strict'

const test = require('tap').test
const util = require('util')
const { FakeSystemInfo } = require('./analysis-util')
const Frames = require('../analysis/stack-trace/frames.js')

test('Stack Trace - frame.toJSON', function (t) {
  const data = [
    {
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionName',
      typeName: 'typeName',
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'eval',
      isEval: true,
      evalOrigin: 'eval at eval.js:1:1'
    },
    {
      functionName: 'functionName',
      isConstructor: true,
      fileName: 'filename.js'
    },
    {
      functionName: 'functionName',
      isNative: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionName',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    }
  ]

  const frames = new Frames(data)

  t.strictSame(
    frames.map((frame) => frame.toJSON()),
    data
  )
  t.end()
})

test('Stack Trace - frame.isNodecore', function (t) {
  const frames = new Frames([
    {
      fileName: 'events.js'
    },
    {
      fileName: 'internal/util.js'
    },
    {
      fileName: '/user/internal/index.js'
    },
    {
      isEval: true,
      evalOrigin: '/node_modules/external/index.js'
    },
    {
      isNative: true,
      fileName: 'native array.js'
    }
  ])
  const root = new FakeSystemInfo('/')

  t.strictSame(
    frames.map((frame) => frame.isNodecore(root)),
    [true, true, false, false, false]
  )
  t.end()
})

test('Stack Trace - frame.isExternal', function (t) {
  const frames = new Frames([
    {
      fileName: 'events.js'
    },
    {
      fileName: 'internal/util.js'
    },
    {
      fileName: '/node_modules/external/index.js'
    },
    {
      isEval: true,
      evalOrigin: '/node_modules/external/index.js'
    },
    {
      isNative: true,
      fileName: 'native array.js'
    },
    {
      fileName: '/user/internal/index.js'
    },
    {
      fileName: '/node_modules/internal/index.js'
    }
  ])

  const root = new FakeSystemInfo('/')
  const modules = new FakeSystemInfo('/node_modules/internal')

  t.strictSame(
    frames.map((frame) => frame.isExternal(root)),
    [true, true, true, true, true, false, true]
  )

  t.strictSame(
    frames.map((frame) => frame.isExternal(modules)),
    [true, true, true, true, true, false, false]
  )

  t.end()
})

test('Stack Trace - frame.getModuleName', function (t) {
  const frames = new Frames([
    {
      fileName: 'events.js'
    },
    {
      fileName: '/node_modules/external/index.js'
    },
    {
      fileName: '/node_modules/@private/internal/index.js'
    },
    {
      fileName: '/node_modules/external/node_modules/deep/index.js'
    }
  ])
  const root = new FakeSystemInfo('/')

  t.strictSame(
    frames.map((frame) => frame.getModuleName(root)), [
      null,
      {
        depth: 1,
        name: 'external'
      },
      {
        depth: 1,
        name: 'internal'
      },
      {
        depth: 2,
        name: 'deep'
      }
    ])

  t.end()
})

test('Stack Trace - frame.getPosition', function (t) {
  const frames = new Frames([
    {
      fileName: 'events.js',
      lineNumber: 10,
      columnNumber: 20
    },
    {
      fileName: 'events.js',
      columnNumber: 20
    },
    {
      fileName: 'events.js',
      lineNumber: 10
    },
    {
      fileName: 'events.js'
    },
    {
      fileName: 'events.js',
      isEval: true,
      evalOrigin: 'eval.js:1:1'
    }
  ])

  t.strictSame(
    frames.map((frame) => frame.getPosition()), [
      'events.js:10:20',
      'events.js:0:20',
      'events.js:10:0',
      'events.js:0:0',
      'events.js:0:0 [eval.js:1:1]'
    ])

  t.end()
})

test('Stack Trace - frame.format', function (t) {
  const frames = new Frames([
    {
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionName',
      typeName: 'typeName',
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'eval',
      isEval: true,
      evalOrigin: 'eval at eval.js:1:1'
    },
    {
      functionName: 'className',
      isConstructor: true,
      fileName: 'filename.js'
    },
    {
      functionName: 'functionName',
      isNative: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionName',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    }
  ])

  t.strictSame(
    frames.map((frame) => frame.format()), [
      '<anonymous> filename.js:2:1',
      'typeName.functionName filename.js:2:1',
      'eval [eval at eval.js:1:1]',
      'new className filename.js:',
      'native functionName filename.js:2:1',
      'functionName filename.js:2:1'
    ])

  t.end()
})

test('Stack Trace - frame.inspect', function (t) {
  const frame = new Frames([
    {
      functionName: 'functionName',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    }
  ]).get(0)

  t.equal(util.inspect(frame, {
    depth: 0
  }), '<Frame functionName filename.js:2:1>')

  t.equal(util.inspect(frame, {
    depth: null
  }), '<Frame functionName filename.js:2:1>')

  t.equal(util.inspect(frame, {
    depth: -1
  }), '<Frame>')

  t.end()
})

test('Stack Trace - frames.formatPositionOnly', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      fileName: 'fileName.js',
      lineNumber: 10,
      columnNumber: 20
    },
    {
      functionName: 'functionB',
      fileName: 'fileName.js',
      lineNumber: 20,
      columnNumber: 10
    }
  ])

  t.equal(
    frames.formatPositionOnly(),
    'fileName.js:10:20\n' +
    'fileName.js:20:10'
  )
  t.end()
})

test('Stack Trace - frames.inspect', function (t) {
  const framesEmpty = new Frames([])

  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.equal(util.inspect(framesEmpty, {
    depth: 1
  }), '<Frames []>')

  t.equal(util.inspect(framesEmpty, {
    depth: null
  }), '<Frames []>')

  t.equal(util.inspect(framesEmpty, {
    depth: 0
  }), '<Frames []>')

  t.equal(util.inspect(framesEmpty, {
    depth: -1
  }), '<Frames>')

  t.equal(util.inspect(frames, {
    depth: 1
  }), '<Frames [\n' +
      '         <Frame functionA filename.js:2:1>,\n' +
      '         <Frame functionB filename.js:4:1>]>')

  t.equal(util.inspect(frames, {
    depth: null
  }), '<Frames [\n' +
      '         <Frame functionA filename.js:2:1>,\n' +
      '         <Frame functionB filename.js:4:1>]>')

  t.equal(util.inspect(frames, {
    depth: 0
  }), '<Frames [<Frame>, <Frame>]>')

  t.equal(util.inspect(frames, {
    depth: -1
  }), '<Frames>')

  t.end()
})

test('Stack Trace - frames.toJSON', function (t) {
  const data = [
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ]
  const frames = new Frames(data)

  t.strictSame(frames.toJSON(), data)
  t.end()
})

test('Stack Trace - frames.length', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])
  t.equal(frames.length, 2)
  t.end()
})

test('Stack Trace - frames.forEach', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  const calls = []
  frames.forEach(function (frame, index) {
    t.equal(frame, frames.get(index))
    calls.push(index)
  })

  t.strictSame(calls, [0, 1])
  t.end()
})

test('Stack Trace - frames.map', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.strictSame(frames.map((frame) => frame.functionName), [
    'functionA',
    'functionB'
  ])
  t.end()
})

test('Stack Trace - frames.filter', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  // filter returns a Frames instance
  const expectedFrames = new Frames([{
    functionName: 'functionB',
    isToplevel: true,
    fileName: 'filename.js',
    lineNumber: 4,
    columnNumber: 1
  }])

  t.strictSame(
    frames.filter((frame) => frame.functionName === 'functionB'),
    expectedFrames
  )
  t.end()
})

test('Stack Trace - frames.every', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.equal(
    frames.every((frame) => frame.fileName === 'filename.js'),
    true
  )
  t.equal(
    frames.every((frame) => frame.functionName === 'functionB'),
    false
  )
  t.end()
})

test('Stack Trace - frames.some', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.equal(
    frames.some((frame) => frame.isToplevel === false),
    false
  )
  t.equal(
    frames.some((frame) => frame.functionName === 'functionB'),
    true
  )
  t.end()
})

test('Stack Trace - frames.first', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.equal(frames.first(), frames.get(0))
  t.end()
})

test('Stack Trace - frames.last', function (t) {
  const frames = new Frames([
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ])

  t.equal(frames.last(), frames.get(1))
  t.end()
})

test('Stack Trace - frames.get', function (t) {
  const data = [
    {
      functionName: 'functionA',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 2,
      columnNumber: 1
    },
    {
      functionName: 'functionB',
      isToplevel: true,
      fileName: 'filename.js',
      lineNumber: 4,
      columnNumber: 1
    }
  ]
  const frames = new Frames(data)

  t.strictSame(frames.get(0).toJSON(), data[0])
  t.strictSame(frames.get(1).toJSON(), data[1])

  t.throws(
    () => frames.get(2),
    new RangeError('index 2 is out of range in frames array of length 2')
  )

  t.throws(
    () => frames.get(-1),
    new RangeError('index -1 is out of range in frames array of length 2')
  )

  t.end()
})
