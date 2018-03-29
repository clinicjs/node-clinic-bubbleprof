'use strict'

const loadData = require('./data/index.js')
const generateLayout = require('./layout/index.js')

loadData(function maybeDone (err, data) {
  if (err) throw err
  window.data = data
  console.log('data is exposed on window.data')

  generateLayout(data)
  // TODO: then continue to draw as in ui-E1 branch
})
