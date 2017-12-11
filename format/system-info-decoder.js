'use strict'

const stream = require('stream')

class SystemInfo {
  constructor (data) {
    this.providers = new Set(data.providers)
    this.pathSeperator = data.pathSeperator
    this.mainDirectory = data.mainDirectory
  }
}

class SystemInfoDecoder extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: false
    })

    this._data = []
  }

  _transform (chunk, encoding, callback) {
    this._data.push(chunk)
    callback(null)
  }

  _flush (callback) {
    this.push(
      new SystemInfo(JSON.parse(Buffer.concat(this._data).toString()))
    )
    callback(null)
  }
}
module.exports = SystemInfoDecoder
