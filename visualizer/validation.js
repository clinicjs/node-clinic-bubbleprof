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

// Keep latest key increments in a weak map so they're specific to each object but allow GC
const countersByObj = new WeakMap()

const mapTest = (key, map) => !map.has(key)
function uniqueMapKey (key, map, separator = '_', startingNum = 0) {
  return getUniqueKey(key, map, mapTest, startingNum, separator)
}

const objectTest = (key, object) => !Object.prototype.hasOwnProperty.call(object, key)
function uniqueObjectKey (key, object, separator = '_', startingNum = 0) {
  return getUniqueKey(key, object, objectTest, startingNum, separator)
}

function getUniqueKey (key, obj, test, startingNum, separator) {
  let countersKeyed = countersByObj.get(obj) || {}
  if (!countersKeyed) {
    countersKeyed = {}
    countersByObj.set(obj, countersKeyed)
  }

  startingNum = Math.max(countersKeyed[key + separator] || 0, startingNum)
  const result = incrementKeyUntilUnique(key, obj, test, startingNum, separator)
  countersKeyed[key + separator] = result.counter
  return result.testKey
}

function incrementKeyUntilUnique (key, obj, test, counter, separator) {
  const testKey = counter ? ('' + key + separator + counter) : key
  if (test(testKey, obj)) {
    return { testKey, counter }
  }
  return incrementKeyUntilUnique(key, obj, test, counter + 1, separator)
}

function removeFromCounter (id, key, obj, separator = '_') {
  const countersKeyed = countersByObj.get(obj)
  if (countersKeyed && typeof countersKeyed[key + separator] === 'number') {
    const counter = numberiseIfNumericString(id.replace(key + separator, ''))
    if (isNumber(counter)) countersKeyed[key + separator] = counter - 1
  }
}

module.exports = {
  isNumber,
  numberiseIfNumericString,
  validateKey,
  validateNumber,
  uniqueMapKey,
  uniqueObjectKey,
  removeFromCounter
}
