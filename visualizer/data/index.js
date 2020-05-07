'use strict'

const DataSet = require('./dataset.js')

// 'json' optional arg allows json to be passed in for browserless tests
function loadData (settings = {}, json = getDataFromPage()) {
  const dataSet = new DataSet(json, settings)
  dataSet.processData()
  return dataSet
}

function getDataFromPage () {
  if (typeof document === 'object') {
    const dataElement = document.querySelector('#clinic-data')
    return JSON.parse(dataElement.textContent)
  }
  return {}
}

module.exports = loadData
