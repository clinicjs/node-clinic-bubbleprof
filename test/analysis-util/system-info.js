'use strict'

const asyncWrap = process.binding('async_wrap')
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
