'use strict'

const stream = require('stream')

class TraceEvent {
  constructor (data) {
    const isCallback = data.name.slice(-'_CALLBACK'.length) === '_CALLBACK'

    if (data.ph === 'b' && !isCallback) {
      this.event = 'init'
    } else if (data.ph === 'e' && !isCallback) {
      this.event = 'destroy'
    } else if (data.ph === 'b' && isCallback) {
      this.event = 'before'
    } else if (data.ph === 'e' && isCallback) {
      this.event = 'after'
    }

    this.type = isCallback ? data.name.slice(0, -'_CALLBACK'.length) : data.name
    this.asyncId = parseInt(data.id, 16)
    this.timestamp = data.ts / 1000 // convert to ms
    this.triggerAsyncId = null
    this.executionAsyncId = null
    if (data.args.hasOwnProperty('triggerAsyncId')) {
      this.triggerAsyncId = data.args.triggerAsyncId
    }
    if (data.args.hasOwnProperty('executionAsyncId')) {
      this.executionAsyncId = data.args.executionAsyncId
    }
  }
}

class JSONParser extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: false
    })

    this._skip = '{"traceEvents":['.length
    this._buffer = null
  }

  _transform (data, enc, cb) {
    if (this._skip) {
      if (data.length <= this._skip) {
        this._skip -= data.length
        return cb(null)
      }
      data = data.slice(this._skip)
      this._skip = 0
    }

    const str = this._buffer ? this._buffer + data.toString() : data.toString()
    this._buffer = null

    var start = 0
    var end = 0

    while ((end = str.indexOf('}},', start)) > -1) {
      const msg = JSON.parse(str.slice(start, end + 2))
      start = end + 3
      this.push(msg)
    }

    this._buffer = str.slice(start)

    return cb()
  }

  _flush (cb) {
    const msg = JSON.parse(this._buffer.slice(0, this._buffer.indexOf('}}') + 2))
    this.push(msg)
    cb(null)
  }
}

class TraceEventDecoder extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: false
    })

    // JSONParser is synchronous so there is no need to think about
    // backpresure
    this.parser = new JSONParser()
    this.parser.on('data', (data) => {
      switch (data.ph) {
        case 'b':
        case 'e':
          this.push(new TraceEvent(data))
          break
        default:
          // Fall-through
      }
    })
  }

  _transform (chunk, encoding, callback) {
    this.parser.write(chunk, encoding)
    callback(null)
  }

  _flush (callback) {
    this.parser.end()
    callback(null)
  }
}
module.exports = TraceEventDecoder
