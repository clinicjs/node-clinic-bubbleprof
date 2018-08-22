'use strict'

const stream = require('stream')
const parser = require('@nearform/trace-events-parser')

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

class TraceEventDecoder extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: false
    })

    // trace-events-parser is synchronous so there is no need to think about
    // backpresure
    this.parser = parser()
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
