'use strict'

const loadData = require('./data/index.js')
const generateLayout = require('./layout/index.js')
const BubbleprofUI = require('./draw/index.js')

const dataSet = loadData()
window.data = dataSet
console.log('data is exposed on window.data')

const layout = generateLayout(dataSet)
window.layout = layout
console.log('layout is exposed on window.layout')

drawUI(data)
// Currently no headless browser testing, only test browser-independent logic
/* istanbul ignore next */
function drawUI (data) {
  const ui = new BubbleprofUI(data)
  ui.draw()
}
