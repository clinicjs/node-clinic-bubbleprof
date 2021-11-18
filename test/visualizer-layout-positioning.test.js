'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')
const shuffle = require('shuffle-array')

const {
  mockTopology,
  topologyToOrderedLeaves,
  topologyToSortedIds
} = require('./visualizer-util/fake-topology.js')

const settings = { debugMode: true }

test('Visualizer layout - positioning - mock topology', function (t) {
  const topology = [
    ['1.2.8', 100],
    ['1.2.6.7', 200],
    ['1.2.3.5', 250],
    ['1.2.3.4', 150],
    ['1.9', 50]
  ]
  const dataSet = loadData(settings, mockTopology(topology))
  t.ok(dataSet)

  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)

  t.same(dataSet.clusterNodes.get(1).children, [2, 9])
  t.equal(layout.layoutNodes.get(1).stem.lengths.scalable, 1)
  t.same(dataSet.clusterNodes.get(2).children, [3, 6, 8])
  t.equal(layout.layoutNodes.get(2).stem.lengths.scalable, 1 + 1)
  t.same(dataSet.clusterNodes.get(8).children, [])
  t.equal(layout.layoutNodes.get(8).stem.lengths.scalable, 1 + 1 + 100)
  t.same(dataSet.clusterNodes.get(6).children, [7])
  t.equal(layout.layoutNodes.get(6).stem.lengths.scalable, 1 + 1 + 1)
  t.same(dataSet.clusterNodes.get(7).children, [])
  t.equal(layout.layoutNodes.get(7).stem.lengths.scalable, 1 + 1 + 1 + 200)
  t.same(dataSet.clusterNodes.get(3).children, [4, 5])
  t.equal(layout.layoutNodes.get(3).stem.lengths.scalable, 1 + 1 + 1)
  t.same(dataSet.clusterNodes.get(5).children, [])
  t.equal(layout.layoutNodes.get(5).stem.lengths.scalable, 1 + 1 + 1 + 250)
  t.same(dataSet.clusterNodes.get(4).children, [])
  t.equal(layout.layoutNodes.get(4).stem.lengths.scalable, 1 + 1 + 1 + 150)
  t.same(dataSet.clusterNodes.get(9).children, [])
  t.equal(layout.layoutNodes.get(9).stem.lengths.scalable, 1 + 50)

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

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedSortedIds = topologyToSortedIds(expectedTopology)
  t.same(layout.getSortedLayoutNodes().map(layoutNode => layoutNode.id), expectedSortedIds)

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

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedSortedIds = topologyToSortedIds(expectedTopology)
  t.same(layout.getSortedLayoutNodes().map(layoutNode => layoutNode.id), expectedSortedIds)

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

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedSortedIds = topologyToSortedIds(expectedTopology)
  t.same(layout.getSortedLayoutNodes().map(layoutNode => layoutNode.id), expectedSortedIds)

  t.end()
})

//            1
//            |
//            2
//           /|
//         10 3_
//         /  | \
//       11   4  7
//       /    |   \
//     12     5    8__
//     /|    /|\   |\ \
//   16 |  18 | \  | \ 17
//     13     | 14 | 15
//            |    9
//            6

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

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0 })

  const positioning = layout.positioning

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedSortedIds = topologyToSortedIds(expectedTopology)
  t.same(expectedSortedIds, [1, 2, 10, 3, 11, 4, 7, 12, 5, 8, 16, 13, 18, 6, 14, 9, 15, 17])
  t.same(layout.getSortedLayoutNodes().map(layoutNode => layoutNode.id), expectedSortedIds)

  t.end()
})

test('Visualizer layout - positioning - debugInspect', function (t) {
  const topology = [
    ['1.9', 50 - 1],
    ['1.2.3.4.12', 150 - 4],
    ['1.2.3.5.11.13.14.15', 250 - 7],
    ['1.2.6.7.10', 200 - 4],
    ['1.8', 100 - 1]
  ]

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = generateLayout(dataSet, { labelMinimumSpace: 0, lineWidth: 0, svgDistanceFromEdge: 0 })

  const positioning = layout.positioning
  t.equal(layout.scale.scaleFactor, 3)
  t.same(positioning.debugInspect(), [
    '',
    '1.9                  ---------- 150',
    '1.2.3.4.12           ------------------------------ 450',
    '1.2.3.5.11.13.14.15  -------------------------------------------------- 750',
    '1.2.6.7.10           ---------------------------------------- 600',
    '1.8                  -------------------- 300'
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
  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(settings, mockTopology(topology))
  const subset = [...dataSet.clusterNodes.values()].filter(node => node.id !== 1 && node.id !== 2)
  const layout = new Layout({ dataNodes: subset }, settings)
  layout.generate(settings)

  const positioning = layout.positioning
  positioning.formClumpPyramid()

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedSortedIds = topologyToSortedIds(expectedTopology)
  const sortedLayoutNodes = layout.getSortedLayoutNodes().map(layoutNode => layoutNode.id)
  t.same(sortedLayoutNodes, expectedSortedIds.filter(id => id !== 1 && id !== 2))

  t.end()
})

test('Visualizer layout - positioning - pyramid - can handle collapsets', function (t) {
  const topology = [
    ['1.12', 50],
    ['1.2.3.4.5', 150],
    ['1.2.3.6.7', 250],
    ['1.2.8.9.10', 200],
    ['1.2.11', 100]
  ]
  const expectedTopology = Object.assign([], topology)
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, settings)
  layout.processHierarchy({ collapseNodes: true })

  const keys = [...layout.layoutNodes.keys()]
  t.same([1, 'x3', 11, 'x1', 5, 7, 9, 10, 12], keys)
  t.same([4, 6], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))
  t.same([2, 3, 8], layout.layoutNodes.get('x3').collapsedNodes.map(layoutNode => layoutNode.id))

  // Arbitrary Map order being issue here
  // const clumpId = [...layout.layoutNodes.keys()].find(key => ['clump', 2, 3, 8].every(c => ('' + key).includes(c)))
  const positioning = layout.positioning
  positioning.formClumpPyramid()

  const expectedOrder = topologyToOrderedLeaves(expectedTopology)
  t.same(positioning.order, expectedOrder)

  const expectedClumpedTopology = [
    ['1.12', 50],
    ['1.x3.x1.5', 400],
    ['1.x3.x1.7', 250],
    ['1.x3.9.10', 200],
    ['1.x3.11', 100]
  ]
  const expectedSortedIds = topologyToSortedIds(expectedClumpedTopology, false)
  t.same(layout.getSortedLayoutNodes().map(layoutNode => `${layoutNode.id}`), expectedSortedIds)

  t.ok(layout.ejectedLayoutNodeIds.includes('x2'))

  t.end()
})

test('Visualizer layout - positioning - pyramid - can handle collapsets with clumpy leaves', function (t) {
  const topology = [
    ['1.12', 1],
    ['1.2.3.4.5', 150],
    ['1.2.3.6.7', 250],
    ['1.2.8.9.10', 200],
    ['1.2.11', 100]
  ]
  shuffle(topology) // Pyramid result should be consistent independent of initial order

  const dataSet = loadData(settings, mockTopology(topology))
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, settings)
  layout.processHierarchy({ collapseNodes: true })

  const keys = [...layout.layoutNodes.keys()]
  t.same([1, 'x4', 11, 'x1', 5, 7, 9, 10], keys)
  t.same([4, 6], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))
  t.same([2, 12, 3, 8], layout.layoutNodes.get('x4').collapsedNodes.map(layoutNode => layoutNode.id))

  const positioning = layout.positioning
  positioning.formClumpPyramid()

  t.same(positioning.order, [5, 7, 10, 11])

  const expectedClumpedTopology = [
    ['1.x4.x1.5', 401],
    ['1.x4.x1.7', 250],
    ['1.x4.9.10', 200],
    ['1.x4.11', 100]
  ]

  const expectedSortedIds = topologyToSortedIds(expectedClumpedTopology, false)
  t.same(layout.getSortedLayoutNodes().map(layoutNode => `${layoutNode.id}`), expectedSortedIds)

  t.ok(layout.ejectedLayoutNodeIds.includes('x2'))
  t.ok(layout.ejectedLayoutNodeIds.includes('x3'))

  t.end()
})
