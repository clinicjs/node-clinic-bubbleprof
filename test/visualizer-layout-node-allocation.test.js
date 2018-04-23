'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const Layout = require('../visualizer/layout/layout.js')
const NodeAllocation = require('../visualizer/layout/node-allocation.js')
const LineCoordinates = require('../visualizer/layout/line-coordinates.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

test('Visualizer layout - node allocation - all assigned leaf units are proportional to parent and add up to 1', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  const unitsById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    unitsById[layoutNode.id] = layoutNode.position.units
  }

  t.equal(unitsById[1], 1)

  t.equal(unitsById[2], 100 / 1000)
  t.equal(unitsById[3], 900 / 1000)

  t.equal(unitsById[4], unitsById[3] * 500 / 1400)
  t.equal(unitsById[6], unitsById[3] * 900 / 1400)

  t.equal(unitsById[5], unitsById[4])
  t.equal((unitsById[7]).toFixed(8), (unitsById[6] * 900 / 1400).toFixed(8))
  t.equal(unitsById[8], unitsById[6] * 500 / 1400)

  t.equal((unitsById[2] + unitsById[5] + unitsById[7] + unitsById[8]).toFixed(0), 1 + '')

  t.end()
})

test('Visualizer layout - node allocation - three-sided space segments depend on layout', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  layout.positioning.nodeAllocation = new NodeAllocation(layout, layout.layoutNodes, NodeAllocation.threeSided)
  const nodeAllocation = layout.positioning.nodeAllocation
  nodeAllocation.process()

  t.equal(nodeAllocation.segments[0].begin, 0)
  t.equal(nodeAllocation.segments[0].end, ((layout.scale.finalSvgHeight * 0.8) - (layout.settings.svgDistanceFromEdge * 2)))
  t.equal(nodeAllocation.segments[1].begin, nodeAllocation.segments[0].end)
  t.equal(nodeAllocation.segments[1].end - nodeAllocation.segments[1].begin, layout.settings.svgWidth - (layout.settings.svgDistanceFromEdge * 2))
  t.equal(nodeAllocation.segments[2].begin, nodeAllocation.segments[1].end)
  t.equal(nodeAllocation.segments[2].end - nodeAllocation.segments[2].begin, nodeAllocation.segments[0].end - nodeAllocation.segments[0].begin)

  t.end()
})

test('Visualizer layout - node allocation - blocks do not overlap or exceed allowed space and follow positioning order', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  const nodeAllocation = layout.positioning.nodeAllocation

  const blocks = []
  for (const segment of nodeAllocation.segments) {
    for (const block of segment.blocks) {
      t.ok(block.center > segment.begin)
      t.ok(block.center < segment.end)
      t.equal(block.layoutNode.position.offset, block.center)
      blocks.push(block)
    }
  }

  t.equal(blocks[0].begin, 0)
  for (let i = 1; i < blocks.length; ++i) {
    t.equal(blocks[i - 1].end, blocks[i].begin)
  }

  t.deepEqual(blocks.map(block => block.layoutNode.id), layout.positioning.order)

  t.end()
})

test('Visualizer layout - node allocation - xy positions of leaves are allocated on the segment lines in 2D space (SPIDER)', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  layout.positioning.nodeAllocation = new NodeAllocation(layout, layout.layoutNodes, NodeAllocation.threeSided)
  const nodeAllocation = layout.positioning.nodeAllocation
  nodeAllocation.process(NodeAllocation.placementMode.SPIDER)

  for (const segment of nodeAllocation.segments) {
    for (const block of segment.blocks) {
      const { x, y } = block.layoutNode.position
      t.ok(x > 0)
      t.ok(y > 0)
      t.deepEqual(segment.line.pointAtLength(block.center - segment.begin), { x, y })
    }
  }

  t.end()
})

test('Visualizer layout - node allocation - xy positions of nodes are allocated between the leaves/segments and node parent at appropriate length (LENGTH_CONSTRAINED)', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  layout.positioning.nodeAllocation = new NodeAllocation(layout, layout.layoutNodes, NodeAllocation.threeSided)
  const nodeAllocation = layout.positioning.nodeAllocation
  nodeAllocation.process(NodeAllocation.placementMode.LENGTH_CONSTRAINED)

  const positionById = {}
  const scaledStemById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    positionById[layoutNode.id] = layoutNode.position
    scaledStemById[layoutNode.id] = layoutNode.stem.getScaled(layout.scale)
  }
  const distanceById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    if (layoutNode.id === 1) {
      // Root node will always have 0 distance
      distanceById[layoutNode.id] = 0
      continue
    }
    distanceById[layoutNode.id] = new LineCoordinates({
      x1: positionById[layoutNode.parent.id].x,
      y1: positionById[layoutNode.parent.id].y,
      x2:
      positionById[layoutNode.id].x,
      y2: positionById[layoutNode.id].y
    }).length
  }

  t.deepEqual(layout.positioning.order, [8, 7, 5, 2])

  t.equal(positionById[1].x, layout.settings.svgWidth / 2)
  t.equal(positionById[1].y, layout.settings.svgDistanceFromEdge + (scaledStemById[1].ownDiameter / 2))

  t.ok(positionById[3].y > positionById[1].y)
  t.ok(positionById[3].x < positionById[1].x)
  t.ok(distanceById[3] < (scaledStemById[1].ownDiameter / 2) + scaledStemById[3].ownBetween * 1.01)
  t.ok(distanceById[3] > (scaledStemById[1].ownDiameter / 2) + scaledStemById[3].ownBetween * 0.99)

  t.ok(positionById[6].y > positionById[3].y)
  t.ok(positionById[6].x < positionById[3].x)
  t.ok(distanceById[6] < (scaledStemById[3].ownDiameter / 2) + scaledStemById[6].ownBetween * 1.01)
  t.ok(distanceById[6] > (scaledStemById[3].ownDiameter / 2) + scaledStemById[6].ownBetween * 0.99)

  t.ok(positionById[8].y > positionById[6].y)
  t.ok(positionById[8].x < positionById[6].x)
  t.ok(distanceById[8] < (scaledStemById[6].ownDiameter / 2) + scaledStemById[8].ownBetween * 1.01)
  t.ok(distanceById[8] > (scaledStemById[6].ownDiameter / 2) + scaledStemById[8].ownBetween * 0.99)

  t.ok(positionById[4].y > positionById[3].y)
  t.ok(positionById[4].x > positionById[3].x)
  t.ok(distanceById[4] < (scaledStemById[3].ownDiameter / 2) + scaledStemById[4].ownBetween * 1.01)
  t.ok(distanceById[4] > (scaledStemById[3].ownDiameter / 2) + scaledStemById[4].ownBetween * 0.99)

  t.ok(positionById[5].y > positionById[4].y)
  t.ok(positionById[5].x > positionById[4].x)
  t.ok(distanceById[5] < (scaledStemById[4].ownDiameter / 2) + scaledStemById[5].ownBetween * 1.01)
  t.ok(distanceById[5] > (scaledStemById[4].ownDiameter / 2) + scaledStemById[5].ownBetween * 0.99)

  t.ok(positionById[2].y > positionById[1].y)
  t.ok(positionById[2].x > positionById[1].x)
  t.ok(distanceById[2] < (scaledStemById[1].ownDiameter / 2) + scaledStemById[2].ownBetween * 1.01)
  t.ok(distanceById[2] > (scaledStemById[1].ownDiameter / 2) + scaledStemById[2].ownBetween * 0.99)
  t.end()
})

test('Visualizer layout - node allocation - can handle subsets', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const subset = [6, 7, 8].map(nodeId => dataSet.clusterNodes.get(nodeId))
  const layout = new Layout({ dataNodes: subset }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.generate()

  layout.positioning.nodeAllocation = new NodeAllocation(layout, layout.layoutNodes, NodeAllocation.threeSided)
  const nodeAllocation = layout.positioning.nodeAllocation
  nodeAllocation.process(NodeAllocation.placementMode.LENGTH_CONSTRAINED)

  const positionById = {}
  const scaledStemById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    positionById[layoutNode.id] = layoutNode.position
    scaledStemById[layoutNode.id] = layoutNode.stem.getScaled(layout.scale)
  }

  const distanceById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    if (layoutNode.id === 6) {
      // As top-level node in this subset, node 6 has same placement as root and 0 distance
      distanceById[layoutNode.id] = 0
      continue
    }
    distanceById[layoutNode.id] = new LineCoordinates({
      x1: positionById[layoutNode.parent.id].x,
      y1: positionById[layoutNode.parent.id].y,
      x2: positionById[layoutNode.id].x,
      y2: positionById[layoutNode.id].y
    }).length
  }

  t.equal(positionById[6].x.toFixed(0), (layout.settings.svgWidth / 2).toFixed(0))
  t.equal(positionById[6].y.toFixed(0), (layout.settings.svgDistanceFromEdge).toFixed(0))

  t.ok(positionById[7].y > positionById[6].y)
  t.ok(positionById[7].x < positionById[6].x)
  t.ok(distanceById[7] < scaledStemById[7].ownBetween * 1.01)
  t.ok(distanceById[7] > scaledStemById[7].ownBetween * 0.99)

  t.ok(positionById[8].y > positionById[6].y)
  t.ok(positionById[8].x > positionById[6].x)
  t.ok(distanceById[8] < scaledStemById[8].ownBetween * 1.01)
  t.ok(distanceById[8] > scaledStemById[8].ownBetween * 0.99)

  t.end()
})

test('Visualizer layout - node allocation - can handle collapsets', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.processHierarchy({ collapseNodes: true })
  // Arbitrary Map order being issue here
  const clumpId = [...layout.layoutNodes.keys()].find(key => ['clump', 3, 4, 6].every(c => ('' + key).includes(c)))
  t.ok(clumpId)
  layout.positioning.formClumpPyramid()
  layout.positioning.placeNodes()

  const positionById = {}
  const scaledStemById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    positionById[layoutNode.id] = layoutNode.position
    scaledStemById[layoutNode.id] = layoutNode.stem.getScaled(layout.scale)
  }

  const distanceById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    if (layoutNode.id === 1) {
      distanceById[layoutNode.id] = 0
      continue
    }
    distanceById[layoutNode.id] = new LineCoordinates({
      x1: positionById[layoutNode.parent.id].x,
      y1: positionById[layoutNode.parent.id].y,
      x2: positionById[layoutNode.id].x,
      y2: positionById[layoutNode.id].y
    }).length
  }

  t.equal(positionById[1].x.toFixed(0), (layout.settings.svgWidth / 2).toFixed(0))
  t.equal(positionById[1].y.toFixed(0), (layout.settings.svgDistanceFromEdge + 1).toFixed(0))

  t.ok(positionById[7].y > positionById[clumpId].y)
  t.ok(positionById[7].x < positionById[clumpId].x)
  t.ok(distanceById[7] < scaledStemById[7].ownBetween * 1.01)
  t.ok(distanceById[7] > scaledStemById[7].ownBetween * 0.99)

  t.ok(positionById[8].y > positionById[clumpId].y)
  t.ok(positionById[8].x > positionById[clumpId].x)
  t.ok(distanceById[8] < scaledStemById[8].ownBetween * 1.01)
  t.ok(distanceById[8] > scaledStemById[8].ownBetween * 0.99)

  t.end()
})

test('Visualizer layout - node allocation - can handle collapsets with clumpy leaves', function (t) {
  const topology = [
    ['1.2', 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  t.ok(dataSet)
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, { labelMinimumSpace: 0, lineWidth: 0 })
  t.ok(layout)
  layout.processHierarchy({ collapseNodes: true })
  // Arbitrary Map order being issue here
  const clumpId = [...layout.layoutNodes.keys()].find(key => ['clump', 2, 3, 4, 6].every(c => ('' + key).includes(c)))
  t.ok(clumpId)
  layout.positioning.formClumpPyramid()
  layout.positioning.placeNodes()

  const positionById = {}
  const scaledStemById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    positionById[layoutNode.id] = layoutNode.position
    scaledStemById[layoutNode.id] = layoutNode.stem.getScaled(layout.scale)
  }

  const distanceById = {}
  for (const layoutNode of layout.layoutNodes.values()) {
    if (layoutNode.id === 1) {
      distanceById[layoutNode.id] = 0
      continue
    }
    distanceById[layoutNode.id] = new LineCoordinates({
      x1: positionById[layoutNode.parent.id].x,
      y1: positionById[layoutNode.parent.id].y,
      x2: positionById[layoutNode.id].x,
      y2: positionById[layoutNode.id].y
    }).length
  }

  t.equal(positionById[1].x.toFixed(0), (layout.settings.svgWidth / 2).toFixed(0))
  t.equal(positionById[1].y.toFixed(0), (layout.settings.svgDistanceFromEdge).toFixed(0))

  t.ok(positionById[5].y > positionById[clumpId].y)
  t.ok(positionById[5].x < positionById[clumpId].x)
  t.ok(distanceById[5] < scaledStemById[5].ownBetween * 1.01)
  t.ok(distanceById[5] > scaledStemById[5].ownBetween * 0.99)

  t.ok(positionById[7].y > positionById[clumpId].y)
  t.ok(positionById[7].x === positionById[clumpId].x)
  t.ok(distanceById[7] < scaledStemById[7].ownBetween * 1.01)
  t.ok(distanceById[7] > scaledStemById[7].ownBetween * 0.99)

  t.ok(positionById[8].y > positionById[clumpId].y)
  t.ok(positionById[8].x > positionById[clumpId].x)
  t.ok(distanceById[8] < scaledStemById[8].ownBetween * 1.01)
  t.ok(distanceById[8] > scaledStemById[8].ownBetween * 0.99)

  t.end()
})
