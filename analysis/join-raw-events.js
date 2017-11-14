'use strict'
const stream = require('stream')

class JoinRawEvents extends stream.Readable {
  constructor (stackTrace, traceEvents) {
    super({ objectMode: true })

    this._awaitRead = false

    this._stackTrace = stackTrace
    this._stackTraceAsyncId = 0
    this._stackTraceEnded = false

    this._traceEvents = traceEvents
    this._traceEventsAsyncId = 0
    this._traceEventsEnded = false

    this._stackTrace.once('end', () => this._stackTraceEnd())
    this._traceEvents.once('end', () => this._traceEventsEnd())
  }

  _stackTracePush (data) {
    this._awaitRead = false
    this._stackTraceAsyncId = Math.max(this._stackTraceAsyncId, data.asyncId)

    this.push({
      type: 'stackTrace',
      info: data
    })
  }

  _stackTraceEnd () {
    this._stackTraceEnded = true
    this._maybeEnded()
  }

  _traceEventsPush (data) {
    this._awaitRead = false
    this._traceEventsAsyncId = Math.max(this._traceEventsAsyncId, data.asyncId)

    this.push({
      type: 'traceEvents',
      info: data
    })
  }

  _traceEventsEnd () {
    this._traceEventsEnded = true
    this._maybeEnded()
  }

  _maybeEnded () {
    if (this._stackTraceEnded && this._traceEventsEnded) {
      this.push(null)
    }
    // If more data is expected and only one stream ended, then make a manual
    // _read call, such that .push(data) is called.
    else if (this._awaitRead) {
      this._read(1)
    }
  }

  _read (size) {
    this._awaitRead = true

    // the asyncId's are approximatively incrementing. Descide what
    // stream to read from by selecting the one where the asyncId is lowest
    if (this._traceEventsEnded || (
      this._stackTraceAsyncId < this._traceEventsAsyncId && !this._traceEventsEnded
    )) {
      const data = this._stackTrace.read()
      if (data === null) {
        this._stackTrace.once('readable', () => {
          const data = this._stackTrace.read()
          if (data !== null) return this._stackTracePush(data)
          // end event handler will call .push()
        })
      } else {
        return this._stackTracePush(data)
      }
    } else {
      const data = this._traceEvents.read()
      if (data === null) {
        this._traceEvents.once('readable', () => {
          const data = this._traceEvents.read()
          if (data !== null) return this._traceEventsPush(data)
          // end event handler will call .push()
        })
      } else {
        return this._traceEventsPush(data)
      }
    }
  }
}
module.exports = JoinRawEvents
