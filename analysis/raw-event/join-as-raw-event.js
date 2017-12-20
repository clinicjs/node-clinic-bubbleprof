'use strict'
const stream = require('stream')
const RawEvent = require('./raw-event.js')

class JoinAsRawEvent extends stream.Readable {
  constructor (stackTrace, traceEvent) {
    super({ objectMode: true })

    this._awaitRead = false

    this._stackTrace = stackTrace
    this._stackTraceAsyncId = 0
    this._stackTraceEnded = false

    this._traceEvent = traceEvent
    this._traceEventAsyncId = 0
    this._traceEventEnded = false

    this._stackTrace.once('end', () => this._stackTraceEnd())
    this._traceEvent.once('end', () => this._traceEventEnd())
  }

  _stackTracePush (data) {
    this._awaitRead = false
    this._stackTraceAsyncId = Math.max(this._stackTraceAsyncId, data.asyncId)

    this.push(RawEvent.wrapStackTrace(data))
  }

  _stackTraceEnd () {
    this._stackTraceEnded = true
    this._maybeEnded()
  }

  _traceEventPush (data) {
    this._awaitRead = false
    this._traceEventAsyncId = Math.max(this._traceEventAsyncId, data.asyncId)

    this.push(RawEvent.wrapTraceEvent(data))
  }

  _traceEventEnd () {
    this._traceEventEnded = true
    this._maybeEnded()
  }

  _maybeEnded () {
    if (this._stackTraceEnded && this._traceEventEnded) {
      this.push(null)
    } else if (this._awaitRead) {
      // If more data is expected and only one stream ended, then make a manual
      // _read call, such that .push(data) is called.
      this._read(1)
    }
  }

  _read (size) {
    this._awaitRead = true

    // the asyncId's are approximatively incrementing. Descide what
    // stream to read from by selecting the one where the asyncId is lowest
    if (this._traceEventEnded || (
      this._stackTraceAsyncId < this._traceEventAsyncId && !this._stackTraceEnded
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
      const data = this._traceEvent.read()
      if (data === null) {
        this._traceEvent.once('readable', () => {
          const data = this._traceEvent.read()
          if (data !== null) return this._traceEventPush(data)
          // end event handler will call .push()
        })
      } else {
        return this._traceEventPush(data)
      }
    }
  }
}
module.exports = JoinAsRawEvent
