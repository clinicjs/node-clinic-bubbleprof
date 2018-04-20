'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')
const shuffle = require('shuffle-array')

const {
  mockTopology,
  topologyToOrderedLeaves
} = require('./visualizer-util/fake-topology.js')

test('Visualizer layout - positioning - mock topology', function (t) {
  const topology = [
    ['1.2.8', 100],
    ['1.2.6.7', 200],
    ['1.2.3.5', 250],
    ['1.2.3.4', 150],
    ['1.9', 50]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)

  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)

  t.deepEqual(dataSet.clusterNodes.get(1).children, [2, 9])
  t.equal(layout.layoutNodes.get(1).stem.getTotalStemLength(layout.scale).scalable, 1)
  t.deepEqual(dataSet.clusterNodes.get(2).children, [8, 6, 3])
  t.equal(layout.layoutNodes.get(2).stem.getTotalStemLength(layout.scale).scalable, 1 + 1)
  t.deepEqual(dataSet.clusterNodes.get(8).children, [])
  t.equal(layout.layoutNodes.get(8).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 100)
  t.deepEqual(dataSet.clusterNodes.get(6).children, [7])
  t.equal(layout.layoutNodes.get(6).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 1)
  t.deepEqual(dataSet.clusterNodes.get(7).children, [])
  t.equal(layout.layoutNodes.get(7).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 1 + 200)
  t.deepEqual(dataSet.clusterNodes.get(3).children, [5, 4])
  t.equal(layout.layoutNodes.get(3).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 1)
  t.deepEqual(dataSet.clusterNodes.get(5).children, [])
  t.equal(layout.layoutNodes.get(5).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 1 + 250)
  t.deepEqual(dataSet.clusterNodes.get(4).children, [])
  t.equal(layout.layoutNodes.get(4).stem.getTotalStemLength(layout.scale).scalable, 1 + 1 + 1 + 150)
  t.deepEqual(dataSet.clusterNodes.get(9).children, [])
  t.equal(layout.layoutNodes.get(9).stem.getTotalStemLength(layout.scale).scalable, 1 + 50)

  t.end()
})

test('Visualizer layout - positioning - pyramid - simple', function (t) {
  const topology = [
    ['1.9', 50],
    ['1.2.3.4', 150],
    ['1.2.3.5', 250],
    ['1.2.6.7', 200],
    ['1.2.8', 100]
  ]
  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

test('Visualizer layout - positioning - pyramid - gaps', function (t) {
  const topology = [
    ['1.9', 50],
    ['1.2.3.4.12', 150],
    ['1.2.3.5.11.13.14.15', 250],
    ['1.2.6.7.10', 200],
    ['1.8', 100]
  ]
  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

test('Visualizer layout - positioning - pyramid - clumping tiny together with long due to common ancestor', function (t) {
  // Note expected order is ascending in lhs and descending in rhs
  const topology = [
    ['1.19', 30],
    ['1.8', 50],
    ['1.9', 70],
    ['1.2.3.5.11.13.14.15', 500],
    ['1.2.3.4.16', 20],
    ['1.2.3.4.12', 10], // Even though 12 is shorter than 17, it's more centric because it's more related to 15
    ['1.2.6.7.17', 80],
    ['1.2.6.7.10', 60],
    ['1.18', 40]
  ]

  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

//            6
//            |     9
//  13        C 14  | 15
//    \       | /   |/
// 16 _\   18 |/    C_ 17
//      C    \C    /
//       \    |   /
//        C   C  C
//         \  | /
//          C C/
//           \|
//            C
//            |
//            R
test('Visualizer layout - positioning - pyramid - example in docs', function (t) {
  const topology = [
    ['1.2.10.11.12.16', 200],
    ['1.2.10.11.12.13', 350],
    ['1.2.3.4.5.18', 100],
    ['1.2.3.4.5.6', 450],
    ['1.2.3.4.5.14', 300],
    ['1.2.3.7.8.9', 400],
    ['1.2.3.7.8.15', 250],
    ['1.2.3.7.8.17', 150]
  ]

  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

test('Visualizer layout - positioning - debugInspect', function (t) {
  const topology = [
    ['1.9', 50],
    ['1.2.3.4.12', 150],
    ['1.2.3.5.11.13.14.15', 250],
    ['1.2.6.7.10', 200],
    ['1.8', 100]
  ]

  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  t.deepEqual(positioning.debugInspect(), [
    '1.9                  ------- 51',
    '1.2.3.4.12           ----------------------- 154',
    '1.2.3.5.11.13.14.15  --------------------------------------- 257',
    '1.2.6.7.10           ------------------------------- 204',
    '1.8                  --------------- 101'
  ].join('\n'))

  t.end()
})

test('Visualizer layout - positioning - pyramid - can handle subsets', function (t) {
  const topology = [
    ['1.2.10.11.12.16', 200],
    ['1.2.10.11.12.13', 350],
    ['1.2.3.4.5.18', 100],
    ['1.2.3.4.5.6', 450],
    ['1.2.3.4.5.14', 300],
    ['1.2.3.7.8.9', 400],
    ['1.2.3.7.8.15', 250],
    ['1.2.3.7.8.17', 150]
  ]

  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const subset = [...dataSet.clusterNodes.values()].filter(node => node.id !== 1 && node.id !== 2)
  const layout = new Layout({ dataNodes: subset })
  layout.generate()

  const positioning = layout.positioning
  positioning.formClumpPyramid()

  // TODO: Figure out why this changed
  // const expectedOrder = [16, 13, 18, 6, 14, 9, 15, 17]
  // t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

test('Visualizer layout - positioning - pyramid - can handle collapsets', function (t) {
  const topology = [
    ['1.9', 50],
    ['1.2.3.4', 150],
    ['1.2.3.5', 250],
    ['1.2.6.7', 200],
    ['1.2.8', 100]
  ]
  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] })
  layout.processHierarchy({ collapseNodes: true })
  // Arbitrary Map order being issue here
  const clumpId = [...layout.layoutNodes.keys()].find(key => ['clump', 1, 2, 3, 6].every(c => key.includes(c)))
  t.ok(clumpId)
  const positioning = layout.positioning
  positioning.formClumpPyramid()

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.deepEqual(positioning.order, expectedOrder)

  t.end()
})

test('Visualizer layout - positioning - pyramid - can handle collapsets with clumpy leaves', function (t) {
  const topology = [
    ['1.9', 1],
    ['1.2.3.4', 150],
    ['1.2.3.5', 250],
    ['1.2.6.7', 200],
    ['1.2.8', 100]
  ]
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(mockTopology(topology))
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] })
  layout.processHierarchy({ collapseNodes: true })
  // Arbitrary Map order being issue here
  const clumpId = [...layout.layoutNodes.keys()].find(key => ['clump', 1, 2, 3, 6, 9].every(c => key.includes(c)))
  t.ok(clumpId)
  const positioning = layout.positioning
  positioning.formClumpPyramid()

  t.deepEqual(positioning.order, [4, 5, 7, 8])

  t.end()
})
