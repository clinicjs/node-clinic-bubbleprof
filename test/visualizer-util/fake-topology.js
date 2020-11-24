'use strict'

function mockClusterNode ({ id, parentId, children, stemLength }) {
  children.sort((a, b) => a - b)
  const clusterNode = {
    // ClusterNode
    clusterId: id,
    parentClusterId: parentId,
    mark: new Map([['party', 'user']]),
    nodes: [
      {
        // AggregateNode
        aggregateId: id,
        parentAggregateId: parentId,
        children,
        frames: [],
        sources: [
          {
            // SourceNode
            asyncId: id,
            i: id,
            init: 0,
            before: [stemLength],
            after: [stemLength],
            aggregateId: id,
            clusterId: id
          }
        ]
      }
    ],
    children
  }
  if (parentId === 0) {
    clusterNode.isRoot = true
  }
  return clusterNode
}

function mockTopology (topology) {
  const clusterNodes = new Map()
  for (const instruction of topology) {
    const ids = instruction[0].split('.').map(id => parseInt(id))
    const totalStemLength = instruction[1]
    const lastId = ids[ids.length - 1]
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i]
      if (clusterNodes.get(id)) {
        continue
      }
      const parentId = ids[i - 1] || 0
      const parentCluster = clusterNodes.get(parentId)
      if (parentCluster) {
        if (!parentCluster.children.includes(id)) {
          parentCluster.children.push(id)
          parentCluster.children.sort((a, b) => a - b)
        }
      }
      const fillerValue = parentId === 0 ? Math.PI : 1 // Root's value is within, not between
      const clusterNode = mockClusterNode({
        id,
        parentId,
        children: [],
        stemLength: id === lastId ? totalStemLength : fillerValue
      })
      clusterNodes.set(id, clusterNode)
    }
  }
  return { data: [...clusterNodes.values()] }
}

function topologyToSplitArrays (topology, numeric = true) {
  return topology.map(d => d[0].split('.').map(i => numeric ? parseInt(i) : i))
}

function topologyToOrderedLeaves (topology, numeric = true) {
  return topologyToSplitArrays(topology, numeric).map(d => d.reverse()[0])
}

function topologyToSortedIds (topology, numeric = true) {
  const splitArrays = topologyToSplitArrays(topology, numeric)
  const maxDepth = splitArrays.reduce((max, arr) => arr.length > max ? arr.length : max, 0)
  const orderedUniqueIds = []
  for (let depth = 0; depth < maxDepth; depth++) {
    for (let arrayIndex = 0; arrayIndex < splitArrays.length; arrayIndex++) {
      const id = splitArrays[arrayIndex][depth]
      if (id && !orderedUniqueIds.includes(id)) orderedUniqueIds.push(id)
    }
  }
  return orderedUniqueIds
}

module.exports = {
  mockClusterNode,
  mockTopology,
  topologyToOrderedLeaves,
  topologyToSortedIds
}
