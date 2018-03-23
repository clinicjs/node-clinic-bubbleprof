'use strict'

const loadData = require('./data/index.js')
const BubbleprofUI = require('./draw/index.js')

loadData(function maybeDone (err, data) {
  if (err) throw err
  window.data = data
  console.log('data is exposed on window.data')

  drawUI(data)
})

// Currently no headless browser testing, only test browser-independent logic
/* istanbul ignore next */
function drawUI (data) {
  const ui = new BubbleprofUI(data)
  ui.draw()
}
