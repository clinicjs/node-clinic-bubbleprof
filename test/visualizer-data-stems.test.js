'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const { isNumber } = require('../visualizer/validation.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const generateLayout = require('../visualizer/layout/index.js')

test('Visualizer data - stems - calculates between and diameter based on stats', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    generateLayout(data)

    const node = data.clusterNodes.get(16)
    const stem = node.stem
    t.equal(stem.ownBetween, node.stats.async.between)
    t.equal(stem.ownDiameter, node.stats.async.within / Math.PI)

    t.end()
  }, slowioJson)
})

test('Visualizer data - stems - calculates length based on ancestors', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    generateLayout(data)

    const stem = data.clusterNodes.get(16).stem
    const totalStemLength = stem.getTotalStemLength()
    t.deepEqual(stem.ancestors.ids, [ 1, 5, 7, 8, 10 ])
    t.equal(totalStemLength.toFixed(8), '21793.56387519')

    const toOwnLength = id => {
      const ancestorStem = data.clusterNodes.get(id).stem
      return ancestorStem.ownBetween + ancestorStem.ownDiameter
    }
    const sum = (a, b) => a + b
    const totalAncestorsLength = stem.ancestors.ids.map(toOwnLength).reduce(sum, 0)
    // Floating point precision acting up here, hence `.toFixed()` both sides
    t.equal((totalStemLength - totalAncestorsLength).toFixed(8), (stem.ownBetween + stem.ownDiameter).toFixed(8))

    t.end()
  }, slowioJson)
})

test('Visualizer data - stems - caches length by scale', function (t) {
  loadData((err, data) => {
    t.ifError(err)

    generateLayout(data)

    const stem = data.clusterNodes.get(16).stem
    t.equal(stem.getTotalStemLength(), stem._totalStemLengthByScale[1])
    t.ok(isNumber(stem.getTotalStemLength()))
    t.equal(stem.getTotalStemLength(5), stem._totalStemLengthByScale[5])
    t.ok(isNumber(stem.getTotalStemLength(5)))

    t.end()
  }, slowioJson)
})
