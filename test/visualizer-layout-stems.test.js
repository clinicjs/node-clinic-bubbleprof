'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const generateLayout = require('../visualizer/layout/index.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

test('Visualizer layout - stems - calculates between and diameter based on stats', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)
  const layout = generateLayout(dataSet)

  const layoutNode = layout.layoutNodes.get(16)
  const stem = layoutNode.stem
  t.equal(stem.raw.ownBetween, layoutNode.node.getBetweenTime())
  t.equal(stem.raw.ownDiameter, layoutNode.node.getWithinTime() / Math.PI)

  t.end()
})

test('Visualizer layout - stems - calculates length based on ancestors and scale', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)
  const layout = generateLayout(dataSet, { labelMinimumSpace: 2, lineWidth: 3 })

  const stem = layout.layoutNodes.get(16).stem
  const totalStemLength = stem.lengths
  t.same(stem.ancestors.ids, [1, 5, 7, 8, 10])
  t.equal(totalStemLength.scalable.toFixed(8), '21897.14445863')
  t.equal(totalStemLength.absolute, (2 * 2 * 5) + (3 * 5))
  t.equal(totalStemLength.rawTotal, totalStemLength.scalable + totalStemLength.absolute)

  const toOwnLength = id => {
    const ancestorStem = layout.layoutNodes.get(id).stem
    return ancestorStem.raw.ownBetween + ancestorStem.raw.ownDiameter
  }
  const sum = (a, b) => a + b
  const totalAncestorsLength = stem.ancestors.ids.map(toOwnLength).reduce(sum, 0)
  // Floating point precision acting up here, hence `.toFixed()` both sides
  t.equal((totalStemLength.scalable - totalAncestorsLength).toFixed(8), (stem.raw.ownBetween + stem.raw.ownDiameter).toFixed(8))

  t.end()
})

test('Visualizer layout - stems - identifies leaves', function (t) {
  const topology = [
    ['1.9', 1],
    ['1.2.3.4', 1],
    ['1.2.3.5', 1],
    ['1.2.6.7', 1],
    ['1.2.8', 1]
  ]

  const dataSet = loadData({ debugMode: true }, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  t.same(layout.layoutNodes.get(1).stem.leaves.ids, [4, 5, 7, 8, 9])
  t.same(layout.layoutNodes.get(9).stem.leaves.ids, [])
  t.same(layout.layoutNodes.get(2).stem.leaves.ids, [4, 5, 7, 8])
  t.same(layout.layoutNodes.get(3).stem.leaves.ids, [4, 5])
  t.same(layout.layoutNodes.get(6).stem.leaves.ids, [7])
  t.same(layout.layoutNodes.get(4).stem.leaves.ids, [])
  t.same(layout.layoutNodes.get(5).stem.leaves.ids, [])
  t.same(layout.layoutNodes.get(7).stem.leaves.ids, [])
  t.same(layout.layoutNodes.get(8).stem.leaves.ids, [])

  t.end()
})
