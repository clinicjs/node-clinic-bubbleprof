'use strict'
const stream = require('stream')
const ClusterNode = require('./cluster-node.js')

class CombineAsClusterNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._clusterId = 2
    this._clusterNodeStroage = new Map()
    this._clusterIdIndexByBarrierId = new Map()

    // Create root ClusterNode
    const clusterNodeRoot = new ClusterNode(1, 0)
    clusterNodeRoot.makeRoot()
    this._clusterNodeStroage.set(clusterNodeRoot.clusterId, clusterNodeRoot)
  }

  _createClusterNode (parentClusterId) {
    const clusterNode = new ClusterNode(this._clusterId++, parentClusterId)
    this._clusterNodeStroage.set(clusterNode.clusterId, clusterNode)
    return clusterNode
  }

  _insertBarrierNode (clusterNode, barrierNode) {
    clusterNode.insertBarrierNode(barrierNode)
    this._clusterIdIndexByBarrierId.set(
      barrierNode.barrierId,
      clusterNode.clusterId
    )
  }

  _transform (barrierNode, encoding, callback) {
    if (barrierNode.isRoot) {
      const clusterNode = this._clusterNodeStroage.get(1)
      this._insertBarrierNode(clusterNode, barrierNode)
      return callback(null)
    }

    // If not a wrapper, this barrierNode marks the begining of a new
    // cluster.
    if (!barrierNode.isWrapper) {
      const parentClusterId = this._clusterIdIndexByBarrierId.get(
        barrierNode.parentBarrierId
      )
      const clusterNode = this._createClusterNode(parentClusterId)
      this._insertBarrierNode(clusterNode, barrierNode)

      const parentClusterNode = this._clusterNodeStroage.get(parentClusterId)
      parentClusterNode.addChild(clusterNode.clusterId)

      return callback(null)
    }

    // The cluster that this BarrierNode belongs too, will be the same
    // as its parent. This is because the BarrierNode is just a wrapper
    // for a AggregateNode.
    const clusterId = this._clusterIdIndexByBarrierId.get(
      barrierNode.parentBarrierId
    )
    const clusterNode = this._clusterNodeStroage.get(clusterId)
    this._insertBarrierNode(clusterNode, barrierNode)
    return callback(null)
  }

  _flush (callback) {
    // basic non-recursive BFS (breadth-first-search)
    const queue = [1] // root has barrierId = 1
    while (queue.length > 0) {
      const clusterNode = this._clusterNodeStroage.get(queue.shift())
      clusterNode.sort()
      this.push(clusterNode)

      // Add children of the newly updated node to the queue
      queue.push(...clusterNode.children)
    }

    callback(null)
  }
}

module.exports = CombineAsClusterNodes
