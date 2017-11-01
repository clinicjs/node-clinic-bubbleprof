'use strict'

class ClinicBubbleprof {
  constructor (settings = {}) {

  }

  collect (args, callback) {
    process.nextTick(callback, new Error('bubbleprof is not implemented'))
  }

  visualize (dataFilename, outputFilename, callback) {
    process.nextTick(callback, new Error('bubbleprof is not implemented'))
  }
}

module.exports = ClinicBubbleprof
