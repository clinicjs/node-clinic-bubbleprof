'use strict'

const loadData = require('./data/index.js')
const generateLayout = require('./layout/index.js')
// then something like based on ui-E1 but made consistent:
// const drawUi = require('./draw-ui/index.js')
// ...which creates an instance of BubbleprofUi from ./draw-ui/bubbleprof-ui.js
// ...which creates from many subclasses

const dataSet = loadData()
window.data = dataSet
console.log('data is exposed on window.data')

const layout = generateLayout(dataSet)
window.layout = layout
console.log('layout is exposed on window.layout')

// TODO: then continue to draw, based on ui-E1 branch but made consistent, like:
//
// const ui = drawUi()
// some action on complete e.g. hide a loading status bar
