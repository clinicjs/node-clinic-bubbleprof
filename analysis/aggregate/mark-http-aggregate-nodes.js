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
      if (node.mark[0] === 'nodecore') {
        node.mark[1] = 'net'
        node.mark[2] = 'server'
      }
    } else if (this._tcpServerNodeIds.has(node.parentNodeId) &&
               (node.type === 'TCPWRAP' || node.type === 'PIPEWRAP')) {
      this._tcpOnconnectionNodeIds.add(node.nodeId)
      if (node.mark[0] === 'nodecore') {
        node.mark[1] = 'net'
        node.mark[2] = 'onconnection'
      }
    } else if (this._tcpOnconnectionNodeIds.has(node.parentNodeId) &&
               node.type === 'HTTPPARSER') {
      if (node.mark[0] === 'nodecore') {
        node.mark[1] = 'http'
        node.mark[2] = 'onrequest'
      }
    }

    done(null, node)
  }
}

module.exports = MarkHttpAggregateNodes
