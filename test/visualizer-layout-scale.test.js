'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')
const { isNumber } = require('../visualizer/validation.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

const svgWidth = 1000
const svgHeight = 1000
const settings = {
  svgWidth,
  svgHeight,
  labelMinimumSpace: 0,
  lineWidth: 0,
  svgDistanceFromEdge: 30,
  allowStretch: true,
  collapseNodes: false
}

test('Visualizer layout - scale - calculates scalable line length', function (t) {
  const topology = [
    ['1.2', svgHeight]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
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
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
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
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.ok(layout.scale.scaleFactor < 0.4 && layout.scale.scaleFactor > 0.3)

  t.end()
})

test('Visualizer layout - scale - demagnifies large longest and stretches height', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7', svgHeight * 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.finalSvgHeight, svgHeight * 1.5)
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - constrained longest superseeds other weights (except stretched longest)', function (t) {
  const topology = [
    ['1.2.3.4', svgHeight * 3],
    ['1.3', svgWidth * 1.4]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()

  t.equal(layout.scale.scalesBySmallest[0].category, 'longest constrained')
  // TODO: Check the significance of stretched longest superseeding here,
  // confirm testing scalesBySmallest[>1] isn't necessary
  t.equal(layout.scale.finalSvgHeight, svgHeight)
  t.ok(layout.scale.scaleFactor < 0.35 && layout.scale.scaleFactor > 0.3)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (width)', function (t) {
  const topology = [
    ['1.2.3.4.5', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.layoutNodes.get(2).stem.raw.ownDiameter = svgWidth
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'diameter clamp')
  t.ok(layout.scale.scaleFactor < 0.25 && layout.scale.scaleFactor > 0.2)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (height)', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const inputHeight = (250 + 30 + 30) * (1 / 1.5)
  const layout = generateLayout(dataSet, Object.assign({}, settings, { svgHeight: inputHeight }))
  layout.layoutNodes.get(2).stem.raw.ownDiameter = 500
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'diameter clamp')
  t.equal(layout.scale.finalSvgHeight, inputHeight * 1.5)
  t.ok(layout.scale.scaleFactor < 0.2 && layout.scale.scaleFactor > 0.1)
  t.end()
})

test('Visualizer layout - scale - demagnifies large q50', function (t) {
  const topology = [
    ['1.3', svgWidth / 0.71],
    ['1.2', (svgWidth / 0.71) + 10],
    ['1.4', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
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
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
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
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'q75 3-4-5 triangle')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - magnifies tiny longest', function (t) {
  const topology = [
    ['1.2.3.4.5', svgHeight / 2]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.ok(layout.scale.scaleFactor < 2 && layout.scale.scaleFactor > 1.8)

  t.end()
})

test('Visualizer layout - scale - scales based on selected subset of nodes', function (t) {
  const topology = [
    ['1.2', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const aggregateNode = dataSet.aggregateNodes.get(2)

  const layout = new Layout({ dataNodes: [aggregateNode] }, settings)
  layout.generate()

  // TODO: re-evaluate and re-activate the logic of these tests against new scale logic
  // t.equal(layout.scale.decisiveWeight.category, 'longest')
  // const totalStemLength = layout.layoutNodes.get(aggregateNode.id).stem.lengths
  // const expectedScaleFactor = ((svgHeight * 1.5) - totalStemLength.absolute) / totalStemLength.scalable
  // t.ok(layout.scale.scaleFactor < expectedScaleFactor * 1.1 && layout.scale.scaleFactor > expectedScaleFactor * 0.9)

  t.end()
})

test('Visualizer layout - scale - demagnifies when absolutes exceed available space', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7.8.9.10.11', 1]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth: 100, svgHeight: 100, svgDistanceFromEdge: 5, labelMinimumSpace: 20, lineWidth: 30, collapseNodes: false })
  layout.scale.calculateScaleFactor()
  layout.updateStems()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.decisiveWeight.absoluteToContain, ((2 * 20) + 30) * 10)
  t.ok(layout.scale.scaleFactor < 0.201 && layout.scale.scaleFactor > 0.199)

  t.end()
})
