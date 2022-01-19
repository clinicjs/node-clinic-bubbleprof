'use strict'

const path = require('path')
const Module = require('module')
const wrapProviders = require('async_hooks').asyncWrapProviders
let asyncWrap

if (wrapProviders) {
  asyncWrap = { Providers: wrapProviders }
} else {
  asyncWrap = process.binding('async_wrap') // eslint-disable-line node/no-deprecated-api
}

function getMainDirectory () {
  if (process._eval != null) return process.cwd()

  let mainScriptIndex = 1
  // `nyc` wraps the script and puts the main script in the second argument
  // This is only needed for our `npm run ci-test`
  if (process.env.NYC_CONFIG && process.argv[1].includes('.node-spawn-wrap')) {
    mainScriptIndex += 1
  }

  if (process.argv[mainScriptIndex] && process.argv[mainScriptIndex] !== '-') {
    return path.dirname(
      Module._resolveFilename(process.argv[mainScriptIndex], null, true)
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
    pathSeparator: require('path').sep,
    mainDirectory: getMainDirectory()
  }
}
module.exports = systemInfo
