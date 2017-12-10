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

  _transform (node, encoding, done) {
    if (node.type === 'TCPSERVERWRAP' || node.type === 'PIPESERVERWRAP') {
      this._tcpServerNodeIds.add(node.nodeId)
      node.setMark('net.server')
    } else if (this._tcpServerNodeIds.has(node.parentNodeId) &&
               (node.type === 'TCPWRAP' || node.type === 'PIPEWRAP')) {
      this._tcpOnconnectionNodeIds.add(node.nodeId)
      node.setMark('net.onconnection')
    } else if (this._tcpOnconnectionNodeIds.has(node.parentNodeId) &&
               node.type === 'HTTPPARSER') {
      node.setMark('http.onrequest')
    }

    done(null, node)
  }
}

module.exports = MarkHttpAggregateNodes
