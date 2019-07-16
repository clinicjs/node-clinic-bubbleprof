'use strict'

const selection = require('d3-selection')

const d3 = Object.assign(
  {},
  // d3.event
  // d3.select
  selection,
  // d3.scaleLinear
  // d3.scaleTime
  require('d3-scale'),
  // d3.arc
  // d3.area
  // d3.pie
  // d3.stack
  require('d3-shape'),
  // d3.axisBottom
  require('d3-axis'),
  // d3.drag
  require('d3-drag'),
  // d3.easeCubicInOut
  require('d3-ease'),
  // d3.format
  require('d3-format'),
  // d3.interpolateNumber
  require('d3-interpolate'),
  // d3.timeFormat
  require('d3-time-format'),
  // d3.timeHour
  // d3.timeMinute
  // d3.timeSecond
  require('d3-time'),
  // d3.selection().transition()
  require('d3-transition'),
  require('d3-color')
)

// This property changes after importing so we fake a live binding.
Object.defineProperty(d3, 'event', {
  get () { return selection.event }
})

module.exports = d3
