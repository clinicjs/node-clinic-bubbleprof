'use strict'

const Frames = require('./frames.js')

class StackTrace {
  constructor (data) {
    this.asyncId = data.asyncId
    this.frames = new Frames(data.frames)
  }

  toJSON () {
    return {
      asyncId: this.asyncId,
      frames: this.frames.toJSON()
    }
  }
}

module.exports = StackTrace
