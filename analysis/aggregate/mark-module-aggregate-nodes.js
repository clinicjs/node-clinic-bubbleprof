'use strict'
const stream = require('stream')

class MarkModuleAggregateNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo
  }

  _transform (aggregateNode, encoding, done) {
    if (aggregateNode.mark.get(0) === 'external') {
      const firstModule = aggregateNode.frames
        .filter((frame) => !frame.isNodecore(this.systemInfo))
        .map((frame) => frame.getModuleName(this.systemInfo))
        .pop()

      aggregateNode.mark.set(1, firstModule.name)
    }

    done(null, aggregateNode)
  }
}

module.exports = MarkModuleAggregateNodes
