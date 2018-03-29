'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const Scale = require('../visualizer/layout/scale.js')

test('Visualizer layout - scale - assigns dummy scale until ui-C2', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    const scale = new Scale()
    scale.setScale()
    t.equal(scale.scale, 1)

    t.end()
  }, slowioJson)
})

test('Visualizer layout - scale - calculates scalable line length', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    const scale = new Scale()
    scale.setScale()
    t.equal(scale.getLineLength(3), 3 * 1)
    t.equal(scale.getLineLength(5), 5 * 1)

    t.end()
  }, slowioJson)
})

test('Visualizer layout - scale - calculates scalable circle radius based on length provided', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    const scale = new Scale()
    scale.setScale()
    t.equal(scale.getCircleRadius(3), (3 * 1) / (2 * Math.PI))
    t.equal(scale.getCircleRadius(5), (5 * 1) / (2 * Math.PI))

    t.end()
  }, slowioJson)
})

test('Visualizer layout - scale - calculates radius based on circumference', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    t.equal(Scale.radiusFromCircumference(3), 3 / (2 * Math.PI))
    t.equal(Scale.radiusFromCircumference(5), 5 / (2 * Math.PI))

    t.end()
  }, slowioJson)
})
