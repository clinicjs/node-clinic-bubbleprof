'use strict'

const Layout = require('./layout.js')
const { Stem } = require('./stems.js')

function generateLayout (callback, dataSet, settings) {
  const layout = new Layout(dataSet, settings)
  layout.generate()
  callback(null, layout)
}

module.exports = generateLayout
