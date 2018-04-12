'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const generateLayout = require('../visualizer/layout/index.js')

test('Visualizer layout - stems - calculates between and diameter based on stats', function (t) {
  const dataSet = loadData(slowioJson)
  const layout = generateLayout(dataSet)

  const layoutNode = layout.layoutNodes.get(16)
  const stem = layoutNode.stem
  t.equal(stem.ownBetween, layoutNode.node.getBetweenTime())
  t.equal(stem.ownDiameter, layoutNode.node.getWithinTime() / Math.PI)

  t.end()
})

test('Visualizer layout - stems - calculates length based on ancestors and scale', function (t) {
  const dataSet = loadData(slowioJson)
  const layout = generateLayout(dataSet, { labelMinimumSpace: 2, lineWidth: 3 })

  const stem = layout.layoutNodes.get(16).stem
  const totalStemLength = stem.getTotalStemLength(layout.scale)
  t.deepEqual(stem.ancestors.ids, [ 1, 5, 7, 8, 10 ])
  t.equal(totalStemLength.scalable.toFixed(8), '21897.14445863')
  t.equal(totalStemLength.absolute, (2 * 2 * 5) + (3 * 5))
  t.equal(totalStemLength.combined, totalStemLength.scalable + totalStemLength.absolute)

  const toOwnLength = id => {
    const ancestorStem = layout.layoutNodes.get(id).stem
    return ancestorStem.ownBetween + ancestorStem.ownDiameter
  }
  const sum = (a, b) => a + b
  const totalAncestorsLength = stem.ancestors.ids.map(toOwnLength).reduce(sum, 0)
  // Floating point precision acting up here, hence `.toFixed()` both sides
  t.equal((totalStemLength.scalable - totalAncestorsLength).toFixed(8), (stem.ownBetween + stem.ownDiameter).toFixed(8))

  t.end()
})

test('Visualizer layout - stems - identifies leaves', function (t) {
  const dataSet = loadData(slowioJson)
  const layout = generateLayout(dataSet)

  const stem = layout.layoutNodes.get(8).stem

  t.deepEqual(stem.leaves.ids, [ 10, 16, 17, 18 ])

  t.end()
})
