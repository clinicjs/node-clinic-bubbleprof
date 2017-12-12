'use strict'

const stream = require('stream')

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
      JSON.parse(Buffer.concat(this._data).toString())
    )
    callback(null)
  }
}
module.exports = SystemInfoDecoder
