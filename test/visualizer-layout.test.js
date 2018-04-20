'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const Layout = require('../visualizer/layout/layout.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

function toLink (layoutNode) {
  return layoutNode.id + ' => ' + layoutNode.children.join(';')
}

// T=Tiny, L=Long, C=Collapsed

// T->T->T->L gives C->L
test('Visualizer layout - collapse - collapses children and parents linearly', function (t) {
  const topology = [
    ['1.2.3.4', 150]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2', '2 => 3', '3 => 4', '4 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['clump:1,2,3 => 4', '4 => '])

  t.end()
})

// T->T->T->L->T->T->L gives C->L->C-L
test('Visualizer layout - collapse - collapses children and parents linearly with break', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(4).stats.async.between = 50 // make 4 long
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2', '2 => 3', '3 => 4', '4 => 5', '5 => 6', '6 => 7', '7 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['clump:1,2,3 => 4', '4 => clump:5,6', 'clump:5,6 => 7', '7 => '])

  t.end()
})

// L->T->L
//  \>T->L
// gives
// L->C->L
//     \>L
test('Visualizer layout - collapse - collapses branches at stem', function (t) {
  const topology = [
    ['1.2.3', 50],
    ['1.4.5', 150]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2;4', '2 => 3', '3 => ', '4 => 5', '5 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['1 => clump:2,4', 'clump:2,4 => 3;5', '5 => ', '3 => '])

  t.end()
})

// T->T->L
//  \>T->L
// gives
// C->L
//  \>L
test('Visualizer layout - collapse - collapses both siblings and parents', function (t) {
  const topology = [
    ['1.2.3', 50],
    ['1.4.5', 150]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2;4', '2 => 3', '3 => ', '4 => 5', '5 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['clump:1,2,4 => 3;5', '5 => ', '3 => '])

  t.end()
})

// T->T->L
//  \>L->L
// gives
// C->L
//  \>L->L
test('Visualizer layout - collapse - collapses children and parents while ignoring some children', function (t) {
  const topology = [
    ['1.2.3', 50],
    ['1.4.5', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(4).stats.async.between = 50 // make 4 long
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2;4', '2 => 3', '3 => ', '4 => 5', '5 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['clump:1,2 => 3;4', '4 => 5', '5 => ', '3 => '])

  t.end()
})

// ?->T->T->L
// ?\>T->L->L
// gives
// ?->C->L
// ?\>T->L->L
test('Visualizer layout - collapse - collapses subset with missing root', function (t) {
  const topology = [
    ['1.2.3.4', 50],
    ['1.5.6.7', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  dataSet.clusterNodes.get(6).stats.async.within = 50 // make 6 long
  const subset = [2, 3, 4, 5, 6, 7].map(nodeId => dataSet.clusterNodes.get(nodeId))
  const layout = new Layout({ dataNodes: subset }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['2 => 3', '3 => 4', '4 => ', '5 => 6', '6 => 7', '7 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['5 => 6', '6 => 7', '7 => ', 'clump:2,3 => 4', '4 => '])

  t.end()
})

// T->T->T->?
//  \>T->L->?
// gives
// C
//  \>L
test('Visualizer layout - collapse - collapses subset with missing leaves', function (t) {
  const topology = [
    ['1.2.3.4', 50],
    ['1.5.6.7', 100]
  ]
  const dataSet = loadData(mockTopology(topology))
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(6).stats.async.within = 75 // make 6 long
  const subset = [1, 2, 3, 5, 6].map(nodeId => dataSet.clusterNodes.get(nodeId))
  const layout = new Layout({ dataNodes: subset }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2;5', '2 => 3', '3 => ', '5 => 6', '6 => '])
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['clump:1,5,2,3 => 6', '6 => '])

  t.end()
})

// T->L
//  \>L->T
//     \>T->T
//     \>T->T
//        \>T
//     \>L->T
//        \>T->T
// gives
// T->L
//  \>L->C
//     \>L->C
test('Visualizer layout - collapse - xyz', function (t) {
  const topology = [
    ['1.2', 50],
    ['1.3.4', 1],
    ['1.3.5.6', 1],
    ['1.3.7.8', 1],
    ['1.3.7.9', 1],
    ['1.3.10.11', 1],
    ['1.3.10.12.13', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(2).stats.async.within = 75 // make 2 long
  dataSet.clusterNodes.get(3).stats.async.within = 75 // make 3 long
  dataSet.clusterNodes.get(10).stats.async.within = 75 // make 10 long
  const layout = new Layout({ dataNodes }, { labelMinimumSpace: 0, lineWidth: 0 })
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualBefore = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualBefore, ['1 => 2;3', '2 => ', '3 => 4;5;7;10', '4 => ', '5 => 6', '6 => ', '7 => 8;9', '8 => ', '9 => ', '10 => 11;12', '11 => ', '12 => 13', '13 => '])
  console.log(layout.scale.scaleFactor)
  t.ok(layout.scale.scaleFactor < 10)
  t.ok(layout.scale.scaleFactor > 9)
  layout.collapseNodes()
  layout.processBetweenData()
  layout.scale.calculateScaleFactor()
  const actualAfter = [...layout.layoutNodes.values()].map(toLink)
  t.deepEqual(actualAfter, ['1 => 2;3', '3 => clump:4,5,6,7,8,9;10', '2 => ', 'clump:4,5,6,7,8,9 => ', '10 => clump:11,12,13', 'clump:11,12,13 => '])

  t.end()
})
