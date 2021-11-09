'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const Layout = require('../visualizer/layout/layout.js')
const { isNumber } = require('../visualizer/validation.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

const svgWidth = 1000
const svgHeight = 1000

const dataSettings = {
  debugMode: true
}

const settings = Object.assign({
  svgWidth,
  svgHeight,
  labelMinimumSpace: 0,
  lineWidth: 0,
  svgDistanceFromEdge: 30,
  allowStretch: true,
  collapseNodes: false
}, dataSettings)

test('Visualizer layout - scale - calculates prescale based on longest', function (t) {
  const topology = [
    ['1.2.3.4', 1],
    ['1.5', svgHeight / 2],
    ['1.2.6', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.ok(layout.scale.prescaleFactor < 2.00 && layout.scale.prescaleFactor > 1.99)

  t.end()
})

test('Visualizer layout - scale - calculates scalable line length', function (t) {
  const topology = [
    ['1.2', svgHeight]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.ok(isNumber(layout.scale.scaleFactor))
  t.equal(layout.scale.getLineLength(3), 3 * layout.scale.scaleFactor)
  t.equal(layout.scale.getLineLength(5), 5 * layout.scale.scaleFactor)

  t.end()
})

test('Visualizer layout - scale - calculates scalable circle radius based on length provided', function (t) {
  const topology = [
    ['1.2', svgHeight]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.ok(isNumber(layout.scale.scaleFactor))
  t.equal(layout.scale.getCircleRadius(3), (3 * layout.scale.scaleFactor) / (2 * Math.PI))
  t.equal(layout.scale.getCircleRadius(5), (5 * layout.scale.scaleFactor) / (2 * Math.PI))

  t.end()
})

test('Visualizer layout - scale - demagnifies large shortest', function (t) {
  const topology = [
    ['1.2', svgWidth],
    ['1.3', svgWidth * 0.9]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'shortest')
  t.ok(layout.scale.scaleFactor < 0.6 && layout.scale.scaleFactor > 0.5)

  t.end()
})

test('Visualizer layout - scale - demagnifies large longest and stretches height', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7', svgHeight * 3]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.finalSvgHeight, svgHeight * 1.5)
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - folds small layouts', function (t) {
  const topology = [
    ['1.2', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  const nodesCount = 2
  t.equal(layout.scale.finalSvgHeight, svgHeight * (0.2 * (nodesCount + 1)))

  t.end()
})

test('Visualizer layout - scale - constrained longest superseeds other weights', function (t) {
  const topology = [
    ['1.2.3.4', svgHeight * 3],
    ['1.5', svgWidth * 1.51],
    ['1.6', svgWidth * 1.51],
    ['1.7', svgWidth * 1.5]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()

  t.equal(layout.scale.scalesBySmallest[0].category, 'longest constrained')
  t.not(layout.scale.scalesBySmallest[1].category, 'longest')
  t.equal(layout.scale.decisiveWeight.category, 'longest constrained')
  t.equal(layout.scale.finalSvgHeight, svgHeight)
  t.ok(layout.scale.scaleFactor < 0.35 && layout.scale.scaleFactor > 0.3)

  t.end()
})

test('Visualizer layout - scale - constrained longest superseeds other weights (except stretched longest)', function (t) {
  const topology = [
    ['1.2.3.4', (svgHeight * 1.5) * 3],
    ['1.5', svgWidth * 0.5],
    ['1.6', svgWidth * 0.5],
    ['1.7', svgWidth * 0.5]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()

  t.equal(layout.scale.scalesBySmallest[0].category, 'longest constrained')
  t.equal(layout.scale.scalesBySmallest[1].category, 'longest')
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.finalSvgHeight, svgHeight * 1.5)
  t.ok(layout.scale.scaleFactor < 0.35 && layout.scale.scaleFactor > 0.3)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (width)', function (t) {
  const topology = [
    ['1.2.3.4.5', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.layoutNodes.get(2).stem.raw.ownDiameter = svgWidth
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'diameter clamp')
  t.ok(layout.scale.scaleFactor < 0.25 && layout.scale.scaleFactor > 0.2)

  t.end()
})

test('Visualizer layout - scale - demagnifies large diameter (height)', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const inputHeight = (250 + 30 + 30) * (1 / 1.5)
  const layout = generateLayout(dataSet, Object.assign({}, settings, { svgHeight: inputHeight }))
  layout.layoutNodes.get(2).stem.raw.ownDiameter = 500
  layout.updateScale()
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
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
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
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
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
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'q75 3-4-5 triangle')
  t.ok(layout.scale.scaleFactor < 0.5 && layout.scale.scaleFactor > 0.4)

  t.end()
})

test('Visualizer layout - scale - magnifies tiny longest', function (t) {
  const topology = [
    ['1.2.3.4.5', svgHeight / 2]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.ok(layout.scale.scaleFactor < 2 && layout.scale.scaleFactor > 1.8)

  t.end()
})

test('Visualizer layout - scale - can handle subsets', function (t) {
  const topology = [
    ['1.2.3.4.5.6', svgHeight * 3],
    ['1.2.3.7.8.9', svgWidth * 0.4],
    ['1.2.10.11.12.13', svgWidth * 0.39],
    ['1.2.3.4.5.14', svgWidth * 0.38],
    ['1.2.3.7.8.15', svgWidth * 0.37],
    ['1.2.10.11.12.16', svgWidth * 0.36],
    ['1.2.3.7.8.17', svgWidth * 0.35],
    ['1.2.3.4.5.18', svgWidth * 0.34]
  ]

  const dataSet = loadData(dataSettings, mockTopology(topology))
  const subset = [...dataSet.clusterNodes.values()].filter(node => node.id !== 1 && node.id !== 2)
  const layout = new Layout({ dataNodes: subset }, dataSettings)
  layout.generate()

  t.ok(layout.scale.scaleFactor < 0.33 && layout.scale.scaleFactor > 0.32)

  t.end()
})

test('Visualizer layout - scale - demagnifies when absolutes exceed available space', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7.8.9.10.11', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, { svgWidth: 100, svgHeight: 100, svgDistanceFromEdge: 5, labelMinimumSpace: 20, lineWidth: 30, collapseNodes: false })
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.decisiveWeight.absoluteToContain, ((2 * 20) + 30) * 10)
  t.ok(layout.scale.scaleFactor < 0.201 && layout.scale.scaleFactor > 0.199)

  t.end()
})

test('Visualizer layout - scale - can handle zero-sized nodes', function (t) {
  const topology = [
    ['1.2', 0],
    ['1.3', 10 - 1],
    ['1.4', 1]
  ]

  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.layoutNodes.get(1).stem.raw.ownDiameter = 0
  layout.layoutNodes.get(2).stem.lengths.scalable = 0
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'longest')
  t.equal(layout.scale.decisiveWeight.weight, (svgHeight - (settings.svgDistanceFromEdge * 2)) / 10)

  t.end()
})

test('Visualizer layout - scale - can handle zero-sized views', function (t) {
  const topology = [
    ['1.2', 0],
    ['1.3', 0],
    ['1.4', 0]
  ]

  const dataSet = loadData(dataSettings, mockTopology(topology))
  const layout = generateLayout(dataSet, settings)
  layout.layoutNodes.get(1).stem.raw.ownDiameter = 0
  layout.layoutNodes.get(2).stem.lengths.scalable = 0
  layout.layoutNodes.get(3).stem.lengths.scalable = 0
  layout.layoutNodes.get(4).stem.lengths.scalable = 0
  layout.updateScale()
  t.equal(layout.scale.decisiveWeight.category, 'zero-sized view')
  const availableShortest = (svgWidth / 2) - settings.svgDistanceFromEdge
  t.equal(layout.scale.decisiveWeight.weight, availableShortest)

  t.end()
})

settings.allowStretch = false
settings.labelMinimumSpace = 10
settings.lineWidth = 10

test('Visualizer layout - scale - calculation height always greater thans longest stem', function (t) {
  function testLongNodeChains (topology) {
    const dataSet = loadData(dataSettings, mockTopology(topology))
    const layout = generateLayout(dataSet, settings)
    layout.updateScale()

    const largestSize = layout.scale.decisiveWeight.absoluteToContain + layout.scale.decisiveWeight.scalableToContain * layout.scale.scaleFactor
    t.ok(layout.scale.finalSvgHeight > largestSize)
    return layout
  }

  testLongNodeChains([
    ['1.2', 100],
    // Long chain of nodes: 1.3.4.5.6.7.8...2998.2999.3000
    ['1.3.' + Array(2997).fill(4).map((num, index) => num + index).join('.'), 5]
  ])

  testLongNodeChains([
    ['1.2', 100],
    ['1.3.' + Array(397).fill(4).map((num, index) => num + index).join('.'), 5],
    ['1.401.' + Array(399).fill(402).map((num, index) => num + index).join('.'), 5],
    ['1.801.' + Array(399).fill(802).map((num, index) => num + index).join('.'), 5],
    ['1.1201.' + Array(399).fill(1202).map((num, index) => num + index).join('.'), 5],
    ['1.1601.' + Array(399).fill(1602).map((num, index) => num + index).join('.'), 5]
  ])

  const layoutWithScaleModifier = testLongNodeChains([
    // Small so scale factor is quite mild and scaledTotal can exceed svgHeight
    ['1.2', 20],
    // Just long enough to have an absolute just below the amount that fits in svgHeight
    ['1.3.' + Array(20).fill(4).map((num, index) => num + index).join('.'), 5]
  ])
  t.equal(layoutWithScaleModifier.scale.decisiveWeight.modifier.toFixed(2), '0.57')

  /* TODO - fix error where this fails with error from arrayFlatten recursion being too deep
  // Very slow test - keep it commented out and uncomment as a smoke test for very large profile issues
  testLongNodeChains([
    ['1.2', 100],
    ['1.3.' + Array(9997).fill(4).map((num, index) => num + index).join('.'), 5]
  ])
  */

  // Test interaction with node collapsing - ensure collapse threshold is adjusted when scale alone can't fit
  settings.collapseNodes = true
  const layoutAdjustedThreshold = testLongNodeChains([
    // Everything tiny so initially almost nothing can be collapsed
    ['1.2.3.4.5', 1],
    // Long enough chain that absolute total exceeds svgHeight
    ['1.6' + Array(26).fill(7).map((num, index) => num + index).join('.'), 1]
  ])
  t.equal(layoutAdjustedThreshold.collapsedLayout.collapseThreshold.toFixed(2), '26.10')

  t.end()
})
