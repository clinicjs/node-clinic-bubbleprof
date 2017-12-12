'use strict'
const util = require('util')
const stream = require('stream')

class MarkModuleAggregateNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo
  }

  _transform (node, encoding, done) {
    if (node.mark.get(0) === 'external') {
      const deepestModule = node.frames
        .filter((frame) => !frame.isNodecore(this.systemInfo))
        .map((frame) => frame.getModuleName(this.systemInfo))
        .shift()

      node.mark.set(1, deepestModule.name)
    }

    done(null, node)
  }
}

module.exports = MarkModuleAggregateNodes
