'use strict'

const data = require('../data.json') // base64 encoded source file

// 'json = data' optional arg allows json to be passed in for browserless tests
function loadData (callback, json = data, settings = {}) {
  setTimeout(function () {
    const data = wrapData(json)

    const defaultSettings = {
      averaging: 'mean', // across callbackEvents. Alternatives: 'median', 'sum'
      quantileRange: 99, // set null to keep all outliers
      idleOnly: false // set true to only count delays when no sync in progress
    }

    settings = Object.assign(defaultSettings, settings)
    data.settings = settings

    callback(null, data)
  })
}
module.exports = loadData

function wrapData (data, settings) {
  if (!data.map) {
    console.warn('No valid data found, data.json contains', typeof data, data)
    return new Map()
  }
  return new Map(
    data.map((node) => [node.clusterId, new ClusterNode(node, settings)])
  )
}
