'use strict'
const stream = require('stream')

class RestructureNetSourceNodes extends stream.Transform {
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
    this._storageByTriggerAsyncId = new Map()
  }

  _processNode (sourceNode) {
    this._observedAsyncIds.add(sourceNode.asyncId)

    if (sourceNode.type === 'TCPSERVERWRAP' ||
        sourceNode.type === 'PIPESERVERWRAP') {
      this._serverAsyncIds.add(sourceNode.asyncId)
    } else if (this._serverAsyncIds.has(sourceNode.triggerAsyncId) &&
               (sourceNode.type === 'TCPWRAP' ||
                sourceNode.type === 'PIPEWRAP')) {
      this._connectionAsyncIds.add(sourceNode.asyncId)
    } else if (this._connectionAsyncIds.has(sourceNode.triggerAsyncId) &&
               !this._serverAsyncIds.has(sourceNode.executionAsyncId)) {
      // Set the children of a socket to the the caller. This can be
      // SHUTDOWNWRAP, WRITEWRAP or some internal nextTick.
      // Nodes that actually comes from the TCPWRAP (in ondata) will have
      // `sourceNode.executionAsyncId === sourceNode.triggerAsyncId` anyway.
      // In the initialzation of the connections, the executionAsyncId is
      // the server onconnection event. We don't want to bind those resources
      // to the server, rather they should just stay on the connection.
      sourceNode.setParentAsyncId(sourceNode.executionAsyncId)
    }
  }

  _processTree (subroot) {
    // process as much of the subtree as possible
    const queue = [subroot]

    while (queue.length > 0) {
      // get node from queue and processs it
      const sourceNode = queue.shift()
      this._processNode(sourceNode)

      // Once the node is processed push to stream
      this.push(sourceNode)

      // Add children of the newly updated node to the queue and delete them
      // from storage.
      if (this._storageByTriggerAsyncId.has(sourceNode.asyncId)) {
        const children = this._storageByTriggerAsyncId.get(sourceNode.asyncId)
        this._storageByTriggerAsyncId.delete(sourceNode.asyncId)
        queue.push(...children)
      }
    }
  }

  _saveNode (sourceNode) {
    if (!this._storageByTriggerAsyncId.has(sourceNode.triggerAsyncId)) {
      this._storageByTriggerAsyncId.set(sourceNode.triggerAsyncId, [])
    }
    this._storageByTriggerAsyncId.get(sourceNode.triggerAsyncId).push(sourceNode)
  }

  _transform (sourceNode, encoding, callback) {
    // If the triggerAsyncId is observed, then we have all the required
    // information for this SourceNode.
    if (this._observedAsyncIds.has(sourceNode.triggerAsyncId)) {
      this._processTree(sourceNode)
    } else {
      this._saveNode(sourceNode)
    }

    callback(null)
  }

  _flush (callback) {
    for (const sourceNodes of this._storageByTriggerAsyncId.values()) {
      for (const sourceNode of sourceNodes) {
        this.push(sourceNode)
      }
    }

    callback(null)
  }
}

module.exports = RestructureNetSourceNodes
