'use strict'

const test = require('tap').test
const {
  isNumber,
  numberiseIfNumericString,
  validateKey,
  validateNumber,
  uniqueMapKey,
  uniqueObjectKey,
  removeFromCounter
} = require('../visualizer/validation.js')

test('Visualizer validation - isNumber', function (t) {
  t.equals(isNumber(123), true)
  t.equals(isNumber(Infinity), true)
  t.equals(isNumber(1e+23), true)
  t.equals(isNumber(1e-23), true)
  t.equals(isNumber('123'), false)
  t.equals(isNumber('1e23'), false)
  t.equals(isNumber(NaN), false)
  t.end()
})

test('Visualizer validation - numberiseIfNumericString', function (t) {
  t.equals(numberiseIfNumericString(123), 123)

  t.equals(numberiseIfNumericString('123'), 123)
  t.equals(numberiseIfNumericString('-123'), -123)
  t.equals(numberiseIfNumericString('1.23'), 1.23)
  t.equals(numberiseIfNumericString('1e+23'), 1e+23)
  t.equals(numberiseIfNumericString('1e-23'), 1e-23)
  t.equals(numberiseIfNumericString(' 123 '), 123)

  t.equals(numberiseIfNumericString('123%'), '123%')
  t.equals(numberiseIfNumericString('A123'), 'A123')
  t.equals(numberiseIfNumericString('1.2.3'), '1.2.3')
  t.equals(numberiseIfNumericString(''), '')
  t.end()
})

test('Visualizer validation - validateKey', function (t) {
  const validOptions = ['1', '2', '3']
  t.equals(validateKey('2', validOptions), true)
  t.throws(() => validateKey(2, validOptions), new Error('Invalid key "2" (typeof number) passed, valid keys are: 1, 2, 3'))
  t.throws(() => validateKey('4', validOptions), new Error('Invalid key "4" (typeof string) passed, valid keys are: 1, 2, 3'))
  t.end()
})

test('Visualizer validation - validateNumber', function (t) {
  t.equals(validateNumber(2), 2)
  t.equals(validateNumber(1e23), 1e23)
  t.throws(() => validateNumber('2'), new Error('Got string 2, must be a number'))
  t.throws(() => validateNumber(NaN), new Error('Got number NaN, must be a number'))

  t.equals(validateNumber(Infinity, 'Allowed infinity', { isFinite: false }), Infinity)
  t.throws(() => validateNumber(Infinity, 'Disallowed infinity'), new Error('Disallowed infinity: Got Infinity, must be finite'))

  t.equals(validateNumber(-1, 'Allowed negative'), -1)
  t.throws(() => validateNumber(-1, 'Disallowed negative', { aboveZero: true }), new Error('Disallowed negative: Got -1, must be > 0'))
  t.end()
})

test('Visualizer validation - uniqueMapKey', function (t) {
  const objectKey = { use: 'as key' }
  const objectKey2 = { use: 'as key' }

  const testMap = new Map([
    ['a', 1],
    ['b', 2],
    ['b_1', 3],
    [99, 4],
    [objectKey, 5]
  ])

  t.equals(uniqueMapKey('c', testMap), 'c')
  t.equals(uniqueMapKey('a', testMap), 'a_1')
  t.equals(uniqueMapKey('b', testMap), 'b_2')
  t.equals(uniqueMapKey(99, testMap), '99_1')
  t.equals(uniqueMapKey(objectKey2, testMap), objectKey2)
  t.equals(uniqueMapKey(objectKey, testMap), '[object Object]_1')

  t.equals(uniqueMapKey('a', testMap, '', 1), 'a1')
  t.equals(uniqueMapKey('b', testMap, '_', 1), 'b_2')
  t.equals(uniqueMapKey('b', testMap, '_', 2), 'b_2')
  t.equals(uniqueMapKey('b', testMap, '_', 3), 'b_3')
  t.equals(uniqueMapKey('c', testMap, '--', 1), 'c--1')

  testMap.set(uniqueMapKey('a', testMap), 6)
  t.equals(uniqueMapKey('a', testMap), 'a_2')

  testMap.set(uniqueMapKey('a', testMap), 7)
  t.equals(uniqueMapKey('a', testMap), 'a_3')

  testMap.set(uniqueMapKey('a', testMap), true)
  testMap.set(uniqueMapKey('a', testMap), true)
  testMap.set(uniqueMapKey('a', testMap), true)
  t.ok(testMap.has('a_5'))
  t.notOk(testMap.has('a_6'))

  testMap.delete('a_3')
  removeFromCounter('a_3', testMap, 'a', '_')
  t.equals(uniqueMapKey('a', testMap), 'a_3')
  testMap.set(uniqueMapKey('a', testMap), true)
  t.equals(uniqueMapKey('a', testMap), 'a_6')

  t.end()
})

test('Visualizer validation - uniqueObjectKey', function (t) {
  const testObject = {
    a: 1,
    b: 2,
    b_1: 3,
    99: 4
  }

  t.equals(uniqueObjectKey('c', testObject), 'c')
  t.equals(uniqueObjectKey('a', testObject), 'a_1')
  t.equals(uniqueObjectKey('b', testObject), 'b_2')
  t.equals(uniqueObjectKey(99, testObject), '99_1')

  t.equals(uniqueObjectKey('a', testObject, '', 1), 'a1')
  t.equals(uniqueObjectKey('b', testObject, '_', 1), 'b_2')
  t.equals(uniqueObjectKey('b', testObject, '_', 2), 'b_2')
  t.equals(uniqueObjectKey('b', testObject, '_', 3), 'b_3')
  t.equals(uniqueObjectKey('c', testObject, '--', 1), 'c--1')

  testObject[uniqueObjectKey('a', testObject)] = 5
  t.equals(uniqueObjectKey('a', testObject), 'a_2')

  testObject[uniqueObjectKey('a', testObject)] = 6
  t.equals(uniqueObjectKey('a', testObject), 'a_3')
  t.end()
})
