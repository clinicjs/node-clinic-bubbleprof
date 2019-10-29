'use strict'

const asyncWrap = process.binding('async_wrap') // eslint-disable-line node/no-deprecated-api
const SystemInfo = require('../../analysis/system-info.js')

class FakeSystemInfo extends SystemInfo {
  constructor (mainDirectory) {
    super({
      providers: [
        'TickObject', 'Timeout', 'Immediate',
        ...Object.keys(asyncWrap.Providers)
      ],
      pathSeparator: '/',
      mainDirectory: mainDirectory // test directory
    })
  }
}

module.exports = FakeSystemInfo
