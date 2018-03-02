'use strict'

const test = require('tap').test
const LineCoordinates = require('../visualizer/layout/line-coordinates.js')

function roundNum (num, places = 5) {
  const adjust = Math.pow(10, places)
  return Math.round(num * adjust) / adjust
}

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
  let spec = { x1: 0, y1: 0, length: 10, degrees: 360 }
  const line1 = new LineCoordinates(spec)

  spec.radians = LineCoordinates.reverseRadians(line1.radians)
  const line2 = new LineCoordinates(spec)
  t.equal(roundNum(line2.degrees), -180)

  line2.preventBackwardsAngle(line1.degrees)
  t.equal(roundNum(line2.degrees), -90)

  t.end()
})

test('Line Coordinates - .preventBackwardsAngle without parent', function (t) {
  let spec = { x1: 0, y1: 0, length: 10, degrees: 90 }
  const line = new LineCoordinates(spec)
  line.preventBackwardsAngle()
  t.equal(spec.degrees, line.degrees)

  t.end()
})
