'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
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
  const dataSet = loadData(slowioJson)

  const parentNode = dataSet.getByNodeType('ClusterNode', 1)
  const childNode = dataSet.getByNodeType('ClusterNode', 3)

  const connection = new Connection(parentNode, childNode, fakeScale)

  t.ok(isNumber(parentNode.getWithinTime()))
  const expectedParentRadius = fakeScale.getCircleRadius(parentNode.getWithinTime())
  t.equal(connection.getSourceRadius(), expectedParentRadius)

  t.ok(isNumber(childNode.getWithinTime()))
  const expectedChildRadius = fakeScale.getCircleRadius(childNode.getWithinTime())
  t.equal(connection.getTargetRadius(), expectedChildRadius)

  t.end()
})

test('Visualizer layout - scale - calculates visible line length based on between of the child node and the scale', function (t) {
  const dataSet = loadData(slowioJson)

  const parentNode = dataSet.getByNodeType('ClusterNode', 1)
  const childNode = dataSet.getByNodeType('ClusterNode', 3)

  const connection = new Connection(parentNode, childNode, fakeScale)
  t.ok(isNumber(childNode.getBetweenTime()))
  const expectedVisibleLength = fakeScale.getLineLength(childNode.getBetweenTime())
  t.equal(connection.getVisibleLineLength(), expectedVisibleLength)

  t.end()
})

test('Visualizer layout - scale - calculates distance between centers', function (t) {
  const dataSet = loadData(slowioJson)

  const parentNode = dataSet.getByNodeType('ClusterNode', 1)
  const childNode = dataSet.getByNodeType('ClusterNode', 3)

  const connection = new Connection(parentNode, childNode, fakeScale)

  const expectedParentRadius = fakeScale.getCircleRadius(parentNode.getWithinTime())
  const expectedChildRadius = fakeScale.getCircleRadius(childNode.getWithinTime())
  const expectedVisibleLength = fakeScale.getLineLength(childNode.getBetweenTime())

  const expectedDistance = expectedParentRadius +
                            expectedChildRadius +
                            expectedVisibleLength +
                            (fakeScale.settings.labelMinimumSpace * 2) +
                            fakeScale.settings.lineWidth
  t.equal(connection.getDistanceBetweenCenters(), expectedDistance)

  t.end()
})
