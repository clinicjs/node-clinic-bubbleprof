'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const { isNumber } = require('../visualizer/validation.js')
const slowioJson = require('./visualizer-util/sampledata-slowio.json')
const Connection = require('../visualizer/layout/connections.js')

const fakeScale = {
  settings: {
    labelMinimumSpace: 5,
    lineWidth: 3
  },
  getCircleRadius: (x) => x * 2,
  getLineLength: (x) => x * 3
}

test('Visualizer layout - scale - calculates visible circle radius based on within of the node and the scale', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)
  const layout = generateLayout(dataSet)

  const parentLayoutNode = layout.layoutNodes.get(1)
  const childLayoutNode = layout.layoutNodes.get(3)

  const connection = new Connection(parentLayoutNode, childLayoutNode, fakeScale)

  t.ok(isNumber(parentLayoutNode.getWithinTime()))
  const expectedParentRadius = fakeScale.getCircleRadius(parentLayoutNode.getWithinTime())
  t.equal(connection.getOriginRadius(), expectedParentRadius)

  t.ok(isNumber(childLayoutNode.getWithinTime()))
  const expectedChildRadius = fakeScale.getCircleRadius(childLayoutNode.getWithinTime())
  t.equal(connection.getTargetRadius(), expectedChildRadius)

  t.end()
})

test('Visualizer layout - scale - calculates visible line length based on between of the child node and the scale', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)
  const layout = generateLayout(dataSet)

  const parentLayoutNode = layout.layoutNodes.get(1)
  const childLayoutNode = layout.layoutNodes.get(3)

  const connection = new Connection(parentLayoutNode, childLayoutNode, fakeScale)
  t.ok(isNumber(childLayoutNode.getBetweenTime()))
  const expectedVisibleLength = fakeScale.getLineLength(childLayoutNode.getBetweenTime())
  t.equal(connection.getVisibleLineLength(), expectedVisibleLength)

  t.end()
})

test('Visualizer layout - scale - calculates distance between centers', function (t) {
  const dataSet = loadData({ debugMode: true }, slowioJson)
  const layout = generateLayout(dataSet)

  const parentLayoutNode = layout.layoutNodes.get(1)
  const childLayoutNode = layout.layoutNodes.get(3)

  const connection = new Connection(parentLayoutNode, childLayoutNode, fakeScale)

  const expectedParentRadius = fakeScale.getCircleRadius(parentLayoutNode.getWithinTime())
  const expectedChildRadius = fakeScale.getCircleRadius(childLayoutNode.getWithinTime())
  const expectedVisibleLength = fakeScale.getLineLength(childLayoutNode.getBetweenTime())

  const expectedDistance = expectedParentRadius +
                            expectedChildRadius +
                            expectedVisibleLength +
                            (fakeScale.settings.labelMinimumSpace * 2) +
                            fakeScale.settings.lineWidth
  t.equal(connection.getDistanceBetweenCenters(), expectedDistance)

  t.end()
})
