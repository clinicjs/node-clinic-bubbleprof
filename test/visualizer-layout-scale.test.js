'use strict'

const test = require('tap').test
const Scale = require('../visualizer/layout/scale.js')

test('Visualizer layout - scale - assigns dummy scale until ui-C2', function (t) {
  const scale = new Scale()
  scale.setScaleFactor()
  t.equal(scale.scaleFactor, 1)

  t.end()
})

test('Visualizer layout - scale - calculates scalable line length', function (t) {
  const scale = new Scale()
  scale.setScaleFactor()
  t.equal(scale.getLineLength(3), 3 * 1)
  t.equal(scale.getLineLength(5), 5 * 1)

  t.end()
})

test('Visualizer layout - scale - calculates scalable circle radius based on length provided', function (t) {
  const scale = new Scale()
  scale.setScaleFactor()
  t.equal(scale.getCircleRadius(3), (3 * 1) / (2 * Math.PI))
  t.equal(scale.getCircleRadius(5), (5 * 1) / (2 * Math.PI))

  t.end()
})
