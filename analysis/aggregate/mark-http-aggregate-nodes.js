'use strict'
const stream = require('stream')

class MarkHttpAggregateNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    // Track servers
    this._tcpServerNodeIds = new Set()
    this._tcpOnconnectionNodeIds = new Set()
  }

  _transform (aggregateNode, encoding, done) {
    if (aggregateNode.type === 'TCPSERVERWRAP' ||
        aggregateNode.type === 'PIPESERVERWRAP') {
      this._tcpServerNodeIds.add(aggregateNode.aggregateId)
      aggregateNode.mark.set(1, 'net')
      aggregateNode.mark.set(2, 'server')
    } else if (this._tcpServerNodeIds.has(aggregateNode.parentAggregateId) &&
               (aggregateNode.type === 'TCPWRAP' ||
                aggregateNode.type === 'PIPEWRAP')) {
      this._tcpOnconnectionNodeIds.add(aggregateNode.aggregateId)
      aggregateNode.mark.set(1, 'net')
      aggregateNode.mark.set(2, 'onconnection')
    } else if (this._tcpOnconnectionNodeIds.has(aggregateNode.parentAggregateId) &&
               aggregateNode.type === 'HTTPPARSER') {
      aggregateNode.mark.set(1, 'net')
      aggregateNode.mark.set(2, 'onrequest')
    }

    done(null, aggregateNode)
  }
}

module.exports = MarkHttpAggregateNodes
