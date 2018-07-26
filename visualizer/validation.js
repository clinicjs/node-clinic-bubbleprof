'use strict'

// Helper functions for validating data
function isNumber (num) {
  return typeof num === 'number' && !Number.isNaN(num)
}
function numberiseIfNumericString (str) {
  if (typeof str !== 'string' || !str.length) return str
  const num = Number(str)
  return isNumber(num) ? num : str
}
function validateKey (key, validOptions) {
  if (typeof key !== 'string' || validOptions.indexOf(key) === -1) {
    throw new Error(`Invalid key "${key}" (typeof ${typeof key}) passed, valid keys are: ${validOptions.join(', ')}`)
  }
  return true
}
function validateNumber (num, targetDescription = '', conditions = {}) {
  const defaultConditions = {
    isFinite: true,
    aboveZero: false
  }
  conditions = Object.assign(defaultConditions, conditions)
  if (targetDescription) targetDescription += ': '

  if (!isNumber(num)) {
    throw new Error(`${targetDescription}Got ${typeof num} ${num}, must be a number`)
  }
  if (conditions.aboveZero && num <= 0) {
    throw new Error(`${targetDescription}Got ${num}, must be > 0`)
  }
  if (conditions.isFinite && !isFinite(num)) {
    throw new Error(`${targetDescription}Got ${num}, must be finite`)
  }

  return num
}

function uniqueMapKey (key, map, separator, startingNum = 0) {
  const test = (key) => !map.has(key)
  return incrementKeyUntilUnique(key, startingNum, test, separator)
}

function uniqueObjectKey (key, object, separator, startingNum = 0) {
  const test = (key) => typeof object[key] === 'undefined'
  return incrementKeyUntilUnique(key, startingNum, test, separator)
}

function incrementKeyUntilUnique (key, counter, test, separator = '_', startAt = null) {
  if (!key && startAt !== null) key = startAt
  const testKey = counter ? `${key}${separator}${counter}` : key
  return test(testKey) ? testKey : incrementKeyUntilUnique(key, counter + 1, test, separator)
}

module.exports = {
  isNumber,
  numberiseIfNumericString,
  validateKey,
  validateNumber,
  uniqueMapKey,
  uniqueObjectKey
}
