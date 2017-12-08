'use strict'
const stream = require('stream')

class ParseTcpSourceNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    // The root and the void is pre-observed
    this._observedAsyncIds = new Set([0, 1])

    // Track what is servers and sockets
    this._serverAsyncIds = new Set()
    this._connectionAsyncIds = new Set()

    // Save source nodes with unobserved triggerAsyncId for later
    this._stroageIndexedByTriggerAsyncId = new Map()
  }

  _processNode(node) {
    this._observedAsyncIds.add(node.asyncId)

    if (node.type === 'TCPSERVERWRAP' || node.type === 'PIPESERVERWRAP') {
      // add as server
      node.setMark('tcp.server')
      this._serverAsyncIds.add(node.asyncId)
    } else if (this._serverAsyncIds.has(node.triggerAsyncId) &&
               node.type === 'TCPWRAP' || node.type === 'PIPEWRAP') {
      // add as connection
      node.setMark('tcp.connection')
      this._connectionAsyncIds.add(node.asyncId)
    } else if (this._connectionAsyncIds.has(node.triggerAsyncId) &&
               !this._serverAsyncIds.has(node.executionAsyncId)) {
      // Set the children of a socket to the the caller. This can be
      // SHUTDOWNWRAP, WRITEWRAP or some internal nextTick.
      // Nodes that actually comes from the TCPWRAP (in ondata) will have
      // `node.executionAsyncId === node.triggerAsyncId` anyway.
      // In the initialzation of the connections, the executionAsyncId is
      // the server onconnection event. We don't want to bind those resources
      // to the server, rather they should just stay on the connection.
      node.setParentAsyncId(node.executionAsyncId)
    }
  }

  _processTree(subroot) {
    // process as much of the subtree as possible
    const queue = [ subroot ]

    while (queue.length > 0) {
      // get node from queue and processs it
      const node = queue.shift()
      this._processNode(node)

      // Once the node is processed push to stream
      this.push(node)

      // Add children of the newly updated node to the queue and delete them
      // from storage.
      if (this._stroageIndexedByTriggerAsyncId.has(node.asyncId)) {
        const children = this._stroageIndexedByTriggerAsyncId.get(node.asyncId)
        this._stroageIndexedByTriggerAsyncId.delete(node.asyncId)
        queue.push(...children)
      }
    }
  }

  _saveNode(node) {
    if (this._stroageIndexedByTriggerAsyncId.has(node.triggerAsyncId)) {
      this._stroageIndexedByTriggerAsyncId.get(node.triggerAsyncId).push(node)
    } else {
      this._stroageIndexedByTriggerAsyncId.set(node.triggerAsyncId, [node])
    }
  }

  _transform (node, encoding, callback) {
    // If the triggerAsyncId is observed, then we have all the information
    // for this node too.
    if (this._observedAsyncIds.has(node.triggerAsyncId)) {
      this._processTree(node)
    } else {
      this._saveNode(node)
    }

    callback(null)
  }

  _flush(callback) {
    if (this._stroageIndexedByTriggerAsyncId.size > 0) {
      callback(new Error('some nodes are without parent'))
    } else {
      callback(null)
    }
  }
}

module.exports = ParseTcpSourceNodes
