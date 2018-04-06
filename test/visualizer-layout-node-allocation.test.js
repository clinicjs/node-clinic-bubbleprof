'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const generateLayout = require('../visualizer/layout/index.js')
const NodeAllocation = require('../visualizer/layout/node-allocation.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

test('Visualizer layout - node allocation - wip', function (t) {
  const topology = [
    ['1.2', 100 - 1],
    ['1.3.4.5', 500 - 3],
    ['1.3.6.7', 900 - 3],
    ['1.3.6.8', 500 - 3]
  ]
  const dataSet = loadData(mockTopology(topology))
  const layout = generateLayout(dataSet)
  t.ok(dataSet)

  const nodeAllocation = new NodeAllocation(layout, [...dataSet.clusterNodes.values()])
  nodeAllocation.process()

  t.end()
})

// 1 => 1

// 2 => 100/1000
// 3 => 900/1000

// 4 => 500/1400
// 6 => 900/1400
