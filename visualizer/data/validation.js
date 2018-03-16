'use strict'

// Helper functions for validating data

function isNumber (num) {
  return typeof num === 'number' && !Number.isNaN(num)
}
function areNumbers (arr) {
  let result = !!arr.length
  arr.forEach((num) => { if (!isNumber(num)) result = false })
  return result
}
function validateKey (key, validOptions) {
  if (typeof key !== 'string' || validOptions.indexOf(key) === -1) {
    throw new Error(`Invalid key "${key}" passed, valid types are: ${validOptions.join(', ')}`)
  }
}

module.exports = {
  isNumber,
  areNumbers,
  validateKey
}
