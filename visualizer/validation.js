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
// Currently only used in /draw code
/* istanbul ignore next */
function isInstanceOf (obj, arr) {
  return arr.some(constructorFunc => obj instanceof constructorFunc)
}
// Currently only used in /draw code
/* istanbul ignore next */
function uniqueMapKey (key, map) {
  let counter = 0
  function keyWithIncrement () {
    counter++
    const newKey = `${key}_${counter}`
    return map.has(newKey) ? keyWithIncrement() : newKey
  }
  return map.has(key) ? keyWithIncrement(key + '_') : key
}

module.exports = {
  isNumber,
  areNumbers,
  validateKey,
  isInstanceOf,
  uniqueMapKey
}
