'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')

const {
  mockTopology
} = require('./visualizer-util/fake-topology.js')

// T=Tiny, L=Long, C=Collapsed

// T->T->T->L gives C->L
test('Visualizer layout - collapse - collapses children and parents linearly', function (t) {
  const topology = [
    ['1.2.3.4', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  const collapsed = Layout.collapseNodes(layout.nodes, { scaleFactor: 1 })
  const actual = collapsed.map(ch => ch.id || ch.children.map(ch => ch.id))
  t.deepEqual(actual, [[1, 2, 3], 4])

  t.end()
})

// L->T->L
//  \>T->L
// gives
// L->C->L
//     \>L
test('Visualizer layout - collapse - collapses branches at stem', function (t) {
  const topology = [
    ['1.2.3', 100],
    ['1.4.5', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  dataSet.clusterNodes.get(1).stats.async.between = 100 // make root long
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  const collapsed = Layout.collapseNodes(layout.nodes, { scaleFactor: 1 })
  const actual = collapsed.map(ch => ch.id || ch.children.map(ch => ch.id))
  t.deepEqual(actual, [1, [2, 4], 3, 5])

  t.end()
})

// T->T->L
//  \>T->L
// gives
// C->L
//  \>L
test('Visualizer layout - collapse - collapses both siblings and parents', function (t) {
  const topology = [
    ['1.2.3', 100],
    ['1.4.5', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  const collapsed = Layout.collapseNodes(layout.nodes, { scaleFactor: 1 })
  const actual = collapsed.map(ch => ch.id || ch.children.map(ch => ch.id))
  t.deepEqual(actual, [[1, 2, 4], 3, 5])

  t.end()
})

// T->T->L
//  \>L->L
// gives
// C->L
//  \>L
test('Visualizer layout - collapse - collapses both siblings and parents', function (t) {
  const topology = [
    ['1.2.3', 100],
    ['1.4.5', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  dataSet.clusterNodes.get(4).stats.async.between = 100 // make node 4 long
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  const collapsed = Layout.collapseNodes(layout.nodes, { scaleFactor: 1 })
  const actual = collapsed.map(ch => ch.id || ch.children.map(ch => ch.id))
  t.deepEqual(actual, [[1, 2], 3, 4, 5])

  t.end()
})

// T->T->L
//  \>L->L
// gives
// C->L
//  \>L
/* TODO: Reactivate and fix this test when collapse feature is added
test('Visualizer layout - collapse - works with missing leaves', function (t) {
  const topology = [
    ['1.2.3', 100],
    ['1.4.5', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  dataSet.clusterNodes.get(4).stats.async.between = 100 // make node 4 long
  const subset = [1, 2, 3, 4].map(nodeId => dataSet.clusterNodes.get(nodeId))
  const layout = new Layout(subset, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.prepareLayoutNodes()
  const collapsed = Layout.collapseNodes(layout.nodes, { scaleFactor: 1 })
  const actual = collapsed.map(ch => ch.id || ch.children.map(ch => ch.id))
  t.deepEqual(actual, [[1, 2], 3, 4])

  t.end()
})
*/
