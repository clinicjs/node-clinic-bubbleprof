'use strict'

const data = require('../data.json') // base64 encoded source file

const wrapData = require('./data-node.js').wrapData

// 'json = data' optional arg allows json to be passed in for browserless tests
function loadData (callback, json = data, settings = {}) {
  setTimeout(function () {
    const data = wrapData(json, settings)
    callback(null, data)
  })
}
module.exports = loadData
