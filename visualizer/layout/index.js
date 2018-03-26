'use strict'

const Layout = require('./layout.js')
const { Stem } = require('./stems.js')

function generateLayout (callback, dataSet, settings) {
  const layout = new Layout(dataSet, settings)

  // Two steps here so we can hook in modifications to the properties before proceeding
  // e.g. for tests etc similar to with data/index.js
  layout.generate()
  callback(null, layout)
}

module.exports = generateLayout
