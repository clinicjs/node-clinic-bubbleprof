'use strict'

const path = require('path')
const Module = require('module')
const asyncWrap = process.binding('async_wrap')

function getMainDirectory () {
  if (process._eval != null) return process.cwd()

  if (process.argv[1] && process.argv[1] !== '-') {
    return path.dirname(
      Module._resolveFilename(process.argv[1], null, true)
    )
  }

  return process.cwd()
}

function systemInfo () {
  return {
    providers: [
      'TickObject', 'Timeout', 'Immediate',
      ...Object.keys(asyncWrap.Providers)
    ],
    pathSeperator: require('path').sep,
    mainDirectory: getMainDirectory()
  }
}
module.exports = systemInfo
