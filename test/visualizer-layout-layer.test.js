'use strict'

// This test suite follows step-by-step layout mutation of a single dataset

const test = require('tap').test
const DataSet = require('../visualizer/data/dataset.js')
const Layout = require('../visualizer/layout/layout.js')
const { clusterNodesArray, aggregateNodesArray } = require('./visualizer-util/fake-layered-nodes.js')

const layoutSettings = {
  svgWidth: 1000,
  svgHeight: 1000,
  svgDistanceFromEdge: 30,
  lineWidth: 2.5,
  labelMinimumSpace: 14
}
const stretchableSettings = Object.assign({}, layoutSettings, {
  allowStretch: true
})
// absolute gaps between nodes, in px
const lineExtras = (layoutSettings.lineWidth + layoutSettings.labelMinimumSpace * 2)

test('Visualizer - layer - dataset is healthy', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  t.same([...dataSet.clusterNodes.keys()].sort(), clusterNodesArray.map(node => node.id).sort())
  t.same([...dataSet.aggregateNodes.keys()].sort(), aggregateNodesArray.map(node => node.id).sort())

  dataSet.processData()

  t.equal(dataSet.clusterNodes.get('A').getBetweenTime(), 0)
  t.equal(dataSet.clusterNodes.get('A').getWithinTime(), 24.5)

  t.equal(dataSet.clusterNodes.get('B').getBetweenTime(), 6)
  t.equal(dataSet.clusterNodes.get('B').getWithinTime(), 10.5)

  t.equal(dataSet.clusterNodes.get('C').getBetweenTime(), 8.5)
  t.equal(dataSet.clusterNodes.get('C').getWithinTime(), 2.5)

  t.equal(dataSet.clusterNodes.get('D').getBetweenTime().toFixed(1), '0.1')
  t.equal(dataSet.clusterNodes.get('D').getWithinTime().toFixed(1), '0.7')

  t.equal(dataSet.clusterNodes.get('E').getBetweenTime().toFixed(1), '0.1')
  t.equal(dataSet.clusterNodes.get('E').getWithinTime().toFixed(1), '0.1')

  t.equal(dataSet.clusterNodes.get('F').getBetweenTime().toFixed(1), '0.1')
  t.equal(dataSet.clusterNodes.get('F').getWithinTime().toFixed(1), '0.1')

  t.end()
})

test('Visualizer - layer - layout is healthy on init', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()

  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, layoutSettings)
  // Ensure custom settings get applied over defaults as expected
  t.same(layout.settings, Object.assign({}, layout.settings, layoutSettings))

  t.equal(layout.layoutNodes.get('A').parent, null)
  t.same(layout.layoutNodes.get('A').children, ['B', 'C'])
  t.equal(layout.layoutNodes.get('B').parent.id, layout.layoutNodes.get('A').id)
  t.equal(layout.layoutNodes.get('C').parent.id, layout.layoutNodes.get('A').id)
  t.same(layout.layoutNodes.get('B').children, ['D', 'E'])
  t.equal(layout.layoutNodes.get('D').parent.id, layout.layoutNodes.get('B').id)
  t.equal(layout.layoutNodes.get('E').parent.id, layout.layoutNodes.get('B').id)
  t.same(layout.layoutNodes.get('C').children, [])
  t.same(layout.layoutNodes.get('D').children, [])
  t.same(layout.layoutNodes.get('E').children, ['F'])
  t.equal(layout.layoutNodes.get('F').parent.id, layout.layoutNodes.get('E').id)
  t.same(layout.layoutNodes.get('F').children, [])

  t.end()
})

test('Visualizer - layer - layout stems are healthy on processBetweenData', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, layoutSettings)

  const expected = {
    A: {},
    B: {},
    C: {},
    D: {},
    E: {},
    F: {}
  }

  layout.processBetweenData()

  expected.A.ownBetween = 0
  expected.A.ownDiameter = (24.5 / Math.PI)
  expected.A.ancestors = []
  expected.A.ancestorsBetween = 0
  expected.A.ancestorsDiameter = 0
  expected.A.scalable = expected.A.ancestorsBetween + expected.A.ancestorsDiameter + expected.A.ownBetween + expected.A.ownDiameter
  expected.A.absolute = lineExtras * expected.A.ancestors.length
  expected.A.rawTotal = expected.A.scalable + expected.A.absolute
  t.equal(layout.layoutNodes.get('A').stem.raw.ownBetween.toFixed(2), expected.A.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('A').stem.raw.ownDiameter.toFixed(2), expected.A.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('A').stem.ancestors.ids, expected.A.ancestors)
  t.equal(layout.layoutNodes.get('A').stem.ancestors.totalBetween.toFixed(2), expected.A.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('A').stem.ancestors.totalDiameter.toFixed(2), expected.A.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('A').stem.lengths.scalable.toFixed(2), expected.A.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('A').stem.lengths.absolute.toFixed(2), expected.A.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('A').stem.lengths.rawTotal.toFixed(2), expected.A.rawTotal.toFixed(2))

  expected.B.ownBetween = 6
  expected.B.ownDiameter = (10.5 / Math.PI)
  expected.B.ancestors = ['A']
  expected.B.ancestorsBetween = expected.A.ownBetween
  expected.B.ancestorsDiameter = expected.A.ownDiameter
  expected.B.scalable = expected.B.ancestorsBetween + expected.B.ancestorsDiameter + expected.B.ownBetween + expected.B.ownDiameter
  expected.B.absolute = lineExtras * expected.B.ancestors.length
  expected.B.rawTotal = expected.B.scalable + expected.B.absolute
  t.equal(layout.layoutNodes.get('B').stem.raw.ownBetween.toFixed(2), expected.B.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.raw.ownDiameter.toFixed(2), expected.B.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('B').stem.ancestors.ids, expected.B.ancestors)
  t.equal(layout.layoutNodes.get('B').stem.ancestors.totalBetween.toFixed(2), expected.B.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.ancestors.totalDiameter.toFixed(2), expected.B.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.lengths.scalable.toFixed(2), expected.B.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.lengths.absolute.toFixed(2), expected.B.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.lengths.rawTotal.toFixed(2), expected.B.rawTotal.toFixed(2))

  expected.C.ownBetween = 8.5
  expected.C.ownDiameter = (2.5 / Math.PI)
  expected.C.ancestors = ['A']
  expected.C.ancestorsBetween = expected.A.ownBetween
  expected.C.ancestorsDiameter = expected.A.ownDiameter
  expected.C.scalable = expected.C.ancestorsBetween + expected.C.ancestorsDiameter + expected.C.ownBetween + expected.C.ownDiameter
  expected.C.absolute = lineExtras * expected.C.ancestors.length
  expected.C.rawTotal = expected.C.scalable + expected.C.absolute
  t.equal(layout.layoutNodes.get('C').stem.raw.ownBetween.toFixed(2), expected.C.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.raw.ownDiameter.toFixed(2), expected.C.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('C').stem.ancestors.ids, expected.C.ancestors)
  t.equal(layout.layoutNodes.get('C').stem.ancestors.totalBetween.toFixed(2), expected.C.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.ancestors.totalDiameter.toFixed(2), expected.C.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.lengths.scalable.toFixed(2), expected.C.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.lengths.absolute.toFixed(2), expected.C.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.lengths.rawTotal.toFixed(2), expected.C.rawTotal.toFixed(2))

  expected.D.ownBetween = 0.1
  expected.D.ownDiameter = (0.7 / Math.PI)
  expected.D.ancestors = ['A', 'B']
  expected.D.ancestorsBetween = expected.A.ownBetween + expected.B.ownBetween
  expected.D.ancestorsDiameter = expected.A.ownDiameter + expected.B.ownDiameter
  expected.D.scalable = expected.D.ancestorsBetween + expected.D.ancestorsDiameter + expected.D.ownBetween + expected.D.ownDiameter
  expected.D.absolute = lineExtras * expected.D.ancestors.length
  expected.D.rawTotal = expected.D.scalable + expected.D.absolute
  t.equal(layout.layoutNodes.get('D').stem.raw.ownBetween.toFixed(2), expected.D.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.raw.ownDiameter.toFixed(2), expected.D.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('D').stem.ancestors.ids, expected.D.ancestors)
  t.equal(layout.layoutNodes.get('D').stem.ancestors.totalBetween.toFixed(2), expected.D.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.ancestors.totalDiameter.toFixed(2), expected.D.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.lengths.scalable.toFixed(2), expected.D.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.lengths.absolute.toFixed(2), expected.D.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.lengths.rawTotal.toFixed(2), expected.D.rawTotal.toFixed(2))

  expected.E.ownBetween = 0.1
  expected.E.ownDiameter = (0.1 / Math.PI)
  expected.E.ancestors = ['A', 'B']
  expected.E.ancestorsBetween = expected.A.ownBetween + expected.B.ownBetween
  expected.E.ancestorsDiameter = expected.A.ownDiameter + expected.B.ownDiameter
  expected.E.scalable = expected.E.ancestorsBetween + expected.E.ancestorsDiameter + expected.E.ownBetween + expected.E.ownDiameter
  expected.E.absolute = lineExtras * expected.E.ancestors.length
  expected.E.rawTotal = expected.E.scalable + expected.E.absolute
  t.equal(layout.layoutNodes.get('E').stem.raw.ownBetween.toFixed(2), expected.E.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.raw.ownDiameter.toFixed(2), expected.E.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('E').stem.ancestors.ids, expected.E.ancestors)
  t.equal(layout.layoutNodes.get('E').stem.ancestors.totalBetween.toFixed(2), expected.E.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.ancestors.totalDiameter.toFixed(2), expected.E.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.lengths.scalable.toFixed(2), expected.E.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.lengths.absolute.toFixed(2), expected.E.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.lengths.rawTotal.toFixed(2), expected.E.rawTotal.toFixed(2))

  expected.F.ownBetween = 0.1
  expected.F.ownDiameter = (0.1 / Math.PI)
  expected.F.ancestors = ['A', 'B', 'E']
  expected.F.ancestorsBetween = expected.A.ownBetween + expected.B.ownBetween + expected.E.ownBetween
  expected.F.ancestorsDiameter = expected.A.ownDiameter + expected.B.ownDiameter + expected.E.ownDiameter
  expected.F.scalable = expected.F.ancestorsBetween + expected.F.ancestorsDiameter + expected.F.ownBetween + expected.F.ownDiameter
  expected.F.absolute = lineExtras * expected.F.ancestors.length
  expected.F.rawTotal = expected.F.scalable + expected.F.absolute
  t.equal(layout.layoutNodes.get('F').stem.raw.ownBetween.toFixed(2), expected.F.ownBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.raw.ownDiameter.toFixed(2), expected.F.ownDiameter.toFixed(2))
  t.same(layout.layoutNodes.get('F').stem.ancestors.ids, expected.F.ancestors)
  t.equal(layout.layoutNodes.get('F').stem.ancestors.totalBetween.toFixed(2), expected.F.ancestorsBetween.toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.ancestors.totalDiameter.toFixed(2), expected.F.ancestorsDiameter.toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.lengths.scalable.toFixed(2), expected.F.scalable.toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.lengths.absolute.toFixed(2), expected.F.absolute.toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.lengths.rawTotal.toFixed(2), expected.F.rawTotal.toFixed(2))

  t.end()
})

test('Visualizer - layer - layout connections are healthy on processBetweenData', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, layoutSettings)

  layout.processBetweenData()

  t.equal(layout.connections[0].originId, 'A')
  t.equal(layout.connections[0].originNode, dataSet.clusterNodes.get('A'))
  t.equal(layout.connections[0].originNode.constructor.name, 'ClusterNode')
  t.equal(layout.connections[0].targetId, 'B')
  t.equal(layout.connections[0].targetNode, dataSet.clusterNodes.get('B'))
  t.equal(layout.connections[0].targetNode.constructor.name, 'ClusterNode')

  t.equal(layout.connections[1].originId, 'B')
  t.equal(layout.connections[1].originNode, dataSet.clusterNodes.get('B'))
  t.equal(layout.connections[1].originNode.constructor.name, 'ClusterNode')
  t.equal(layout.connections[1].targetId, 'D')
  t.equal(layout.connections[1].targetNode, dataSet.clusterNodes.get('D'))
  t.equal(layout.connections[1].targetNode.constructor.name, 'ClusterNode')

  t.equal(layout.connections[2].originId, 'B')
  t.equal(layout.connections[2].originNode, dataSet.clusterNodes.get('B'))
  t.equal(layout.connections[2].originNode.constructor.name, 'ClusterNode')
  t.equal(layout.connections[2].targetId, 'E')
  t.equal(layout.connections[2].targetNode, dataSet.clusterNodes.get('E'))
  t.equal(layout.connections[2].targetNode.constructor.name, 'ClusterNode')

  t.equal(layout.connections[3].originId, 'E')
  t.equal(layout.connections[3].originNode, dataSet.clusterNodes.get('E'))
  t.equal(layout.connections[3].originNode.constructor.name, 'ClusterNode')
  t.equal(layout.connections[3].targetId, 'F')
  t.equal(layout.connections[3].targetNode, dataSet.clusterNodes.get('F'))
  t.equal(layout.connections[3].targetNode.constructor.name, 'ClusterNode')

  t.equal(layout.connections[4].originId, 'A')
  t.equal(layout.connections[4].originNode, dataSet.clusterNodes.get('A'))
  t.equal(layout.connections[4].originNode.constructor.name, 'ClusterNode')
  t.equal(layout.connections[4].targetId, 'C')
  t.equal(layout.connections[4].targetNode, dataSet.clusterNodes.get('C'))
  t.equal(layout.connections[4].targetNode.constructor.name, 'ClusterNode')

  t.end()
})

test('Visualizer - layer - layout scale is healthy on calculateScaleFactor', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, stretchableSettings)

  layout.processBetweenData()
  layout.updateScale()

  const expectedScaleFactor = 25.7102

  t.same(layout.scale.scalesBySmallest.map(weight => [weight.category, weight.weight.toFixed(4)]), [
    ['shortest', expectedScaleFactor + ''],
    ['diameter clamp', '30.1336'],
    ['q50 1-1-sqrt(2) triangle', '32.9860'],
    ['longest constrained', '48.7517'],
    ['longest', '48.7517']
  ])

  t.equal(layout.scale.decisiveWeight.category, 'shortest')
  t.equal(layout.scale.decisiveWeight.node.constructor.name, 'LayoutNode')
  t.equal(layout.scale.decisiveWeight.node.id, 'C')

  const APlusC = (24.5 / Math.PI) + 8.5 + (2.5 / Math.PI)

  t.equal(layout.scale.decisiveWeight.available, (1000 / 2) - 30)
  t.equal(layout.scale.decisiveWeight.absoluteToContain, lineExtras)
  t.equal(layout.scale.decisiveWeight.scalableToContain, APlusC)
  t.equal(layout.scale.decisiveWeight.weight.toFixed(2), ((470 - lineExtras) / APlusC).toFixed(2))
  t.equal(layout.scale.scaleFactor.toFixed(4), expectedScaleFactor + '')

  t.end()
})

test('Visualizer - layer - layout stems are healthy on calculateScaleFactor', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, stretchableSettings)

  layout.processBetweenData()
  layout.updateScale()

  const APlusBPlusD = (24.5 / Math.PI) + 6 + (10.5 / Math.PI) + 0.1 + (0.7 / Math.PI)
  t.equal(layout.scale.prescaleFactor, layout.settings.svgHeight / APlusBPlusD)
  t.ok(layout.scale.prescaleFactor < 58 && layout.scale.prescaleFactor > 57)

  const expectedScaleFactor = 25.7102

  t.equal(layout.layoutNodes.get('A').stem.scaled.ownBetween, lineExtras)
  t.equal(layout.layoutNodes.get('A').stem.scaled.ownDiameter.toFixed(2), ((24.5 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.equal(layout.layoutNodes.get('B').stem.scaled.ownBetween.toFixed(2), (lineExtras + (6 * expectedScaleFactor)).toFixed(2))
  t.equal(layout.layoutNodes.get('B').stem.scaled.ownDiameter.toFixed(2), ((10.5 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.equal(layout.layoutNodes.get('C').stem.scaled.ownBetween.toFixed(2), (lineExtras + (8.5 * expectedScaleFactor)).toFixed(2))
  t.equal(layout.layoutNodes.get('C').stem.scaled.ownDiameter.toFixed(2), ((2.5 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.equal(layout.layoutNodes.get('D').stem.scaled.ownBetween.toFixed(2), (lineExtras + (0.1 * expectedScaleFactor)).toFixed(2))
  t.equal(layout.layoutNodes.get('D').stem.scaled.ownDiameter.toFixed(2), ((0.7 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.equal(layout.layoutNodes.get('E').stem.scaled.ownBetween.toFixed(2), (lineExtras + (0.1 * expectedScaleFactor)).toFixed(2))
  t.equal(layout.layoutNodes.get('E').stem.scaled.ownDiameter.toFixed(2), ((0.1 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.equal(layout.layoutNodes.get('F').stem.scaled.ownBetween.toFixed(2), (lineExtras + (0.1 * expectedScaleFactor)).toFixed(2))
  t.equal(layout.layoutNodes.get('F').stem.scaled.ownDiameter.toFixed(2), ((0.1 / Math.PI) * expectedScaleFactor).toFixed(2))

  t.end()
})

test('Visualizer - layer - layout connections are healthy on calculateScaleFactor', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, layoutSettings)

  layout.processBetweenData()
  layout.updateScale()

  const expectedScaleFactor = 25.7102

  t.equal(layout.connections[0].getOriginRadius().toFixed(2), (((24.5 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // A
  t.equal(layout.connections[0].getTargetRadius().toFixed(2), (((10.5 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // B
  t.equal(layout.connections[0].getVisibleLineLength().toFixed(2), (6 * expectedScaleFactor).toFixed(2))
  t.equal(layout.connections[1].getTargetRadius().toFixed(2), (((0.7 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // D
  t.equal(layout.connections[1].getVisibleLineLength().toFixed(2), (0.1 * expectedScaleFactor).toFixed(2))
  t.equal(layout.connections[2].getTargetRadius().toFixed(2), (((0.1 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // E
  t.equal(layout.connections[2].getVisibleLineLength().toFixed(2), (0.1 * expectedScaleFactor).toFixed(2))
  t.equal(layout.connections[3].getTargetRadius().toFixed(2), (((0.1 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // F
  t.equal(layout.connections[3].getVisibleLineLength().toFixed(2), (0.1 * expectedScaleFactor).toFixed(2))
  t.equal(layout.connections[4].getVisibleLineLength().toFixed(2), (8.5 * expectedScaleFactor).toFixed(2))
  t.equal(layout.connections[4].getTargetRadius().toFixed(2), (((2.5 / Math.PI) / 2) * expectedScaleFactor).toFixed(2)) // C

  t.end()
})

test('Visualizer - layer - layout positioning is healthy on formClumpPyramid', function (t) {
  const dataSet = new DataSet({ data: clusterNodesArray })
  dataSet.processData()
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, layoutSettings)

  layout.processBetweenData()
  layout.updateScale()
  layout.positioning.formClumpPyramid()

  t.equal(layout.layoutNodes.get('C').stem.lengths.rawTotal.toFixed(2), '47.59')
  t.equal(layout.layoutNodes.get('D').stem.lengths.rawTotal.toFixed(2), '78.46')
  t.equal(layout.layoutNodes.get('F').stem.lengths.rawTotal.toFixed(2), '108.90')
  const byLeafOnly = nodeId => !layout.layoutNodes.get(nodeId).children.length
  t.same(layout.positioning.order.filter(byLeafOnly), ['C', 'F', 'D'])

  t.end()
})
