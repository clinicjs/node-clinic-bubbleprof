'use strict'

const data = require('../data.json') // base64 encoded source file

const DataSet = require('./dataset.js')

// 'json = data' optional arg allows json to be passed in for browserless tests
function loadData (settings = {}, json = data) {
  const dataSet = new DataSet(json, settings)
  dataSet.processData()
  return dataSet
}

module.exports = loadData
