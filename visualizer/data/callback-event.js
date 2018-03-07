'use strict'

const allCallbackEvents = []

// The callback functions represented by a sourceNode's unique async_id
// may be called any number of times. To calculate delays and busy time
// we need to look at each call to these callbacks, relative to its source
class CallbackEvent {
  constructor (source, callKey) {
    // Timestamp when this became the next call to this callback
    this.delayStart = callKey === 0 ? source.init : source.after[callKey - 1]

    // Timestamp when this callback call begins
    this.before = source.before[callKey]

    // Timestamp when this callback call completes
    this.after = source.after[callKey]

    this.syncTime = this.after - this.before
    this.rawDelay = this.before - this.delayStart
    this.adjustedDelays = new Map()

    this.source = source

    allCallbackEvents.push(this)
  }
  static identifyOverlaps() {
    // outside class so allCallbackEvents array can be garbage collected
    // event even when instances of CallbackEvent can't be
    identifyOverlaps()
  }
}

function identifyOverlaps () {
  console.groupCollapsed('Callback events')

  for (let i = 0; i < allCallbackEvents.length; i++) {
    const callbackEvent = allCallbackEvents[i];

    console.log(callbackEvent)
    // look at previous callbacks, etc
  }
  console.groupEnd()
}

module.exports = CallbackEvent
