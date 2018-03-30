'use strict'

const Layout = require('./layout.js')

function generateLayout (dataSet, settings) {
  const layout = new Layout(dataSet, settings)

  // Two steps here so we can hook in modifications to the properties before proceeding
  // e.g. for tests etc similar to with data/index.js
  layout.generate()
  return layout
}

module.exports = generateLayout
