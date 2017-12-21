'use strict'

const loaddata = require('./data.js')

loaddata(function maybeDone (err, data) {
  if (err) throw err
  window.data = data
  console.log('data is exposed on window.data')
})
