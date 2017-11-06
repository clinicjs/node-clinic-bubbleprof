'use strict'
const stream = require('stream')

class JoinEvents extends stream.Readable {
  constructor (stackTrace, traceEvents) {
    super({ objectMode: true })

    this._stackTrace = stackTrace
    this._stackTraceAsyncId = 0
    this._stackTraceEnded = false

    this._traceEvents = traceEvents
    this._traceEventsAsyncId = 0
    this._traceEventsEnded = false

    this._stackTrace.on('readable', () => {
      const data = this._stackTrace.read()
      if (data !== null) return this._stackTracePush(data)
      this._stackTraceEnd()
    })

    this._traceEvents.on('readable', () => {
      const data = this._traceEvents.read()
      if (data !== null) return this._traceEventsPush(data)
      this._traceEventsEnd()
    })
  }

  _stackTracePush (data) {
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
    } else {
      // Unless both are ended, continue reading
      this._read(1)
    }
  }

  _read (size) {
    // the asyncId's are approximatively incrementing. Descide what
    // stream to read from by selecting the one where the asyncId is lowest
    if (this._traceEventsEnded || (
      this._stackTraceAsyncId < this._traceEventsAsyncId && !this._traceEventsEnded
    )) {
      const data = this._stackTrace.read()
      if (data !== null) return this._stackTracePush(data)
      // else: there is a readable handler, that will call .push()
    } else {
      const data = this._traceEvents.read()
      if (data !== null) return this._traceEventsPush(data)
      // else: there is a readable handler, that will call .push()
    }
  }
}
module.exports = JoinEvents
