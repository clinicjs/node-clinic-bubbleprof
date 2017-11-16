'use strict'

const loaddata = require('./data.js')

loaddata(function maybeDone (err, data) {
  if (err) throw err
  console.log(data)
})
