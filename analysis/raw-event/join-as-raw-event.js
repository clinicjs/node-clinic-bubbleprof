'use strict'
const stream = require('stream')
const RawEvent = require('./raw-event.js')
const v8 = require('v8')

const HEAP_MAX = v8.getHeapStatistics().heap_size_limit

class JoinAsRawEvent extends stream.Readable {
  constructor (stackTrace, traceEvent) {
    super({ objectMode: true })

    this._awaitRead = false

    this._stackTrace = stackTrace
    this._stackTraceAsyncId = 0
    this._stackTraceEnded = false
    this._reads = 0
    this._destroyed = false

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
    if (this._destroyed) return
    if (this._stackTraceEnded && this._traceEventEnded) {
      this.push(null)
    } else if (this._awaitRead) {
      // If more data is expected and only one stream ended, then make a manual
      // _read call, such that .push(data) is called.
      this._read(1)
    }
  }

  _read (size) {
    if (this._destroyed) return

    this._awaitRead = true
    this._reads++

    /* istanbul ignore next */
    if ((this._reads & 4095) === 0 && !hasFreeMemory()) {
      this._destroyed = true
      this.emit('truncate')
      this.push(null)
      this._stackTrace.destroy()
      this._traceEvent.destroy()
      return
    }

    // the asyncId's are approximately incrementing. Decide what
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

function hasFreeMemory () {
  const used = process.memoryUsage().heapTotal / HEAP_MAX
  return used < 0.5
}
