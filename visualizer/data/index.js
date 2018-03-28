'use strict'

const data = require('../data.json') // base64 encoded source file

const { DataSet } = require('./data-node.js')

// 'json = data' optional arg allows json to be passed in for browserless tests
function loadData (callback, json = data, settings = {}) {
  const dataSet = new DataSet(json, settings)
  dataSet.processData()
  callback(null, dataSet)
}
module.exports = loadData
