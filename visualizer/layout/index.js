'use strict'

const Layout = require('./layout.js')

function generateLayout (dataSet, settings) {
  const layout = new Layout([...dataSet.clusterNodes.values()], settings)

  // This will be interrupted when generating sublayouts
  layout.prepareLayoutNodes()

  // This can be interrupted in tests etc
  layout.generate()
  return layout
}

module.exports = generateLayout
