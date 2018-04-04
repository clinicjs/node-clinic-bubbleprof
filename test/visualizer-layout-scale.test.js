'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')
const Scale = require('../visualizer/layout/scale.js')
const { isNumber } = require('../visualizer/validation.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

const svgWidth = 1000
const svgHeight = 1000

test('Visualizer layout - scale - uses default settings', function (t) {
  const scale = new Scale()
  t.ok(isNumber(scale.settings.lineWidth))
  t.ok(isNumber(scale.settings.labelMinimumSpace))

  t.end()
})

test('Visualizer layout - scale - calculates scalable line length', function (t) {
  const topology = [
    ['1.2', svgHeight]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.ok(isNumber(layout.scale.scaleFactor))
  t.equal(layout.scale.getLineLength(3), 3 * layout.scale.scaleFactor)
  t.equal(layout.scale.getLineLength(5), 5 * layout.scale.scaleFactor)

  t.end()
})

test('Visualizer layout - scale - calculates scalable circle radius based on length provided', function (t) {
  const topology = [
    ['1.2', svgHeight]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.ok(isNumber(layout.scale.scaleFactor))
  t.equal(layout.scale.getCircleRadius(3), (3 * layout.scale.scaleFactor) / (2 * Math.PI))
  t.equal(layout.scale.getCircleRadius(5), (5 * layout.scale.scaleFactor) / (2 * Math.PI))

  t.end()
})

test('Visualizer layout - scale - demagnifies large shortest', function (t) {
  const topology = [
    ['1.2', svgWidth],
    ['1.3', svgWidth * 2.01]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'shortest')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - demagnifies large longest and stretches height', function (t) {
  const topology = [
    ['1.2', svgHeight * 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.finalSvgHeight, 1500)
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (width)', function (t) {
  const topology = [
    ['1.2', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  dataSet.getByNodeType('ClusterNode', 2).stem.ownDiameter = svgWidth
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'diameter clamp')
  t.ok(layout.scale.scaleFactor < 0.25 && layout.scale.scaleFactor > 0.2)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (height)', function (t) {
  const topology = [
    ['1.2', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight: svgHeight / 4 })
  dataSet.getByNodeType('ClusterNode', 2).stem.ownDiameter = svgHeight / 2
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'diameter clamp')
  t.ok(layout.scale.scaleFactor < 0.3 && layout.scale.scaleFactor > 0.2)

  t.end()
})

test('Visualizer layout - scale - demagnifies large q50', function (t) {
  const topology = [
    ['1.3', svgWidth / 0.71],
    ['1.2', (svgWidth / 0.71) + 10],
    ['1.4', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'q50 1-1-sqrt(2) triangle')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - demagnifies large q25', function (t) {
  const topology = [
    ['1.3', svgWidth / 0.8],
    ['1.2', (svgWidth / 0.8) + 20],
    ['1.4', (svgWidth / 0.8) + 10],
    ['1.5', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'q25 4-3-5 triangle')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - demagnifies large q75', function (t) {
  const topology = [
    ['1.5', 1],
    ['1.3', svgWidth / 0.6],
    ['1.2', (svgWidth / 0.6) + 10],
    ['1.4', 1],
    ['1.6', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'q75 3-4-5 triangle')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - magnifies tiny longest', function (t) {
  const topology = [
    ['1.2', svgHeight / 2]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth, svgHeight })
  layout.scale.calculateScaleFactor()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.ok(layout.scale.scaleFactor < 3 && layout.scale.scaleFactor > 2.8)

  t.end()
})

test('Visualizer layout - scale - scales based on selected subset of nodes', function (t) {
  const topology = [
    ['1.2', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const aggregateNode = dataSet.getByNodeType('ClusterNode', 2).nodes.get(2)

  const layout = new Layout([aggregateNode], { svgWidth, svgHeight })
  layout.generate()

  t.equal(layout.scale.decisiveWeight.category, 'longest')
  const expectedScaleFactor = (svgHeight * 1.5) / aggregateNode.stem.getTotalStemLength()
  t.ok(layout.scale.scaleFactor < expectedScaleFactor * 1.1 && layout.scale.scaleFactor > expectedScaleFactor * 0.9)

  t.end()
})
