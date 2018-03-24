'use strict'

const loadData = require('./data/index.js')

loadData(function maybeDone (err, data) {
  if (err) throw err
  window.data = data
  console.log('data is exposed on window.data')
})
