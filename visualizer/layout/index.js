'use strict'

const Layout = require('./layout.js')

function generateLayout (dataSet, settings) {
  const layout = new Layout({ dataNodes: [...dataSet.clusterNodes.values()] }, settings)

  // This can be interrupted in tests etc
  layout.generate(settings)
  return layout
}

module.exports = generateLayout
