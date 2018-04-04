'use strict'

// During development, use entire D3 library for ease of use
const d3 = require('d3')

/* TODO: on launch, refine down to a subset of d3's microlibraries

// Reduce file size by only including the d3 modules that are used
const d3 = Object.assign(
  require('d3-selection'),
  // Assign all chosen microlibraries to d3-selection to preserve d3.event's live binding
  // see https://github.com/d3/d3/issues/3102
  require('d3-array'),
  require('d3-force'),
  require('d3-hierarchy'),
  require('d3-scale'),
  require('d3-shape'),
  require('d3-time-format')
)

*/

module.exports = d3
