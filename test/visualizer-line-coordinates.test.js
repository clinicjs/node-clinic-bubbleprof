'use strict'

const test = require('tap').test
const LineCoordinates = require('../visualizer/layout/line-coordinates.js')

function roundNum (num, places = 5) {
  const adjust = Math.pow(10, places)
  return Math.round(num * adjust) / adjust
}

test('Line Coordinates - throw on invalid arguments', function (t) {
  t.throws(() => new LineCoordinates(), new Error('x1 and y1 of new LineCoordinates must be numeric'))
  t.throws(() => new LineCoordinates({}), new Error('x1 and y1 of new LineCoordinates must be numeric'))

  const validArgSets = [
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    { x1: 0, y1: 0, length: 1, radians: 0 },
    { x1: 0, y1: 0, length: 1, degrees: 1 }
  ]
  const errorByArg = {
    x1: 'x1 and y1 of new LineCoordinates must be numeric',
    y1: 'x1 and y1 of new LineCoordinates must be numeric',
    x2: 'length or (x2, y2) of new LineCoordinates must be numeric',
    y2: 'length or (x2, y2) of new LineCoordinates must be numeric',
    length: 'length or (x2, y2) of new LineCoordinates must be numeric',
    radians: 'radians or degrees of new LineCoordinates must be numeric',
    degrees: 'radians or degrees of new LineCoordinates must be numeric'
  }
  for (const argSet of validArgSets) {
    for (const arg of Object.keys(argSet)) {
      const spec = Object.assign({}, argSet)
      t.doesNotThrow(() => new LineCoordinates(spec))
      spec[arg] = 'string'
      t.throws(() => new LineCoordinates(spec), new Error(errorByArg[arg]))
      delete spec[arg]
      t.throws(() => new LineCoordinates(spec), new Error(errorByArg[arg]))
    }
  }

  t.end()
})

test('Line Coordinates - new LineCoordinates from xy', function (t) {
  const spec = { x1: 0, y1: 0, x2: 20, y2: 0 }
  const line = new LineCoordinates(spec)

  t.equal(line.length, 20)
  t.equal(line.radians, 0)

  t.end()
})

test('Line Coordinates - new LineCoordinates from length and radians', function (t) {
  const spec = { x1: 0, y1: 0, length: 20, radians: Math.PI / 2 }
  const line = new LineCoordinates(spec)

  t.equal(roundNum(line.x2), 0)
  t.equal(roundNum(line.y2), 20)

  t.end()
})

test('Line Coordinates - new LineCoordinates from length and degrees', function (t) {
  const spec = { x1: 0, y1: 0, length: 20, degrees: 90 }
  const line = new LineCoordinates(spec)

  t.equal(roundNum(line.x2), 0)
  t.equal(roundNum(line.y2), 20)

  t.end()
})

test('Line Coordinates - LineCoordinates.isAngleBackwards', function (t) {
  let parentDegrees, acceptableRange, spec, line, result

  parentDegrees = 90
  acceptableRange = 90
  spec = { x1: 0, y1: 0, x2: 0, y2: 20 }
  line = new LineCoordinates(spec)
  result = line.isAngleBackwards(parentDegrees, acceptableRange)
  t.notOk(result)

  parentDegrees = 90
  acceptableRange = 90
  spec = { x1: 0, y1: 0, x2: 10, y2: -10 }
  line = new LineCoordinates(spec)
  result = line.isAngleBackwards(parentDegrees, acceptableRange)
  t.ok(result)
  t.equal(result.problem, '<')
  t.equal(roundNum(result.acceptableAngle), 0)

  parentDegrees = 135
  acceptableRange = 45
  spec = { x1: 0, y1: 0, x2: -10, y2: -10 }
  line = new LineCoordinates(spec)
  result = line.isAngleBackwards(parentDegrees, acceptableRange)
  t.ok(result)
  t.equal(result.problem, '>')
  t.equal(roundNum(result.acceptableAngle), 180)

  t.end()
})

test('Line Coordinates - Reverse and adjust a line', function (t) {
  const spec = { x1: 0, y1: 0, length: 10, degrees: 360 }
  const line1 = new LineCoordinates(spec)

  const line2 = new LineCoordinates({
    radians: LineCoordinates.reverseRadians(line1.radians),
    x1: line1.x2,
    y1: line1.y2,
    length: line1.length
  })
  t.equal(roundNum(line2.degrees), -180)

  line2.preventBackwardsAngle(line1.degrees)
  t.equal(roundNum(line2.degrees), -90)

  t.end()
})

test('Line Coordinates - .preventBackwardsAngle without parent', function (t) {
  const spec = { x1: 0, y1: 0, length: 10, degrees: 90 }
  const line = new LineCoordinates(spec)
  line.preventBackwardsAngle()
  t.equal(spec.degrees, line.degrees)

  t.end()
})

test('Line Coordinates - calculates radius based on circumference', function (t) {
  t.equal(LineCoordinates.radiusFromCircumference(3), 3 / (2 * Math.PI))
  t.equal(LineCoordinates.radiusFromCircumference(5), 5 / (2 * Math.PI))

  t.end()
})
