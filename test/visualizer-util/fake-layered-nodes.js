'use strict'

const {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents
} = require('./fake-overlapping-nodes.js')

const newAggregateNodes = {
  i: { parentAggregateId: 'g' },
  j: { parentAggregateId: 'i' },
  k: { parentAggregateId: 'i' },
  l: { parentAggregateId: 'j' },
  m: { parentAggregateId: 'g' },
  n: { parentAggregateId: 'm' }
}
Object.entries(newAggregateNodes).forEach(keyValue => aggregateNodes.set(keyValue[0], keyValue[1]))

const newClusterNodes = {
  D: { nodes: ['i', 'j', 'k', 'l'], parentClusterId: 'B' },
  E: { nodes: ['m'], parentClusterId: 'B' },
  F: { nodes: ['n'], parentClusterId: 'E' }
}
Object.entries(newClusterNodes).forEach(keyValue => clusterNodes.set(keyValue[0], keyValue[1]))

const newCallbackEvents = [
  { i: 17, delayStart: 30, before: 30.1, after: 30.2, aggregateId: 'i', clusterId: 'D' },
  { i: 18, delayStart: 30.2, before: 30.3, after: 30.4, aggregateId: 'j', clusterId: 'D' },
  { i: 19, delayStart: 30.4, before: 30.5, after: 30.6, aggregateId: 'k', clusterId: 'D' },
  { i: 20, delayStart: 30.6, before: 30.7, after: 30.8, aggregateId: 'l', clusterId: 'D' },
  { i: 21, delayStart: 30.8, before: 30.9, after: 31, aggregateId: 'm', clusterId: 'E' },
  { i: 22, delayStart: 31, before: 31.1, after: 31.2, aggregateId: 'n', clusterId: 'F' }
]
newCallbackEvents.forEach(item => dummyCallbackEvents.push(item))

/**
 * Diagram showing how the above nodes interrelate:
 *
 *                    -----------------
 *                   |*** CLUSTER A ***|
 *                   |    [ag root]    |
 *                   |       /  \      |
 *                   |  [ag a] [ag b]  |
 *                   |     / \    \    |
 *                   |[ag c]  \    \   |
 *                    ---/-----\----\--
 *                      /       \    \
 *           ----------/----     \ ---\-----------
 *          |** CLUSTER B **|     \** CLUSTER C **|
 *          |      [ag d]   |     |\   [ag e]     |
 *          |       /       |     | \             |
 *          |    [ag f]     |     |  \            |
 *          |        \      |     |   \           |
 *          |        [ag g] |     |    [ag h]     |
 *           ---------/---\-       ---------------
 *         --------------  \    ---------------
 *        |** CLUSTER D **| \  |** CLUSTER E **|
 *        |      [ag i]   |  \ |               |
 *        |      /   \    |   \|               |
 *        | [ag j]  [ag k]|    \               |
 *        |     \         |    |\              |
 *        |    [ag l]     |    | [ag m]        |
 *         ---------------      ------\-------
 *                                 ----\----------
 *                                |** CLUSTER F **|
 *                                |    [ag n]     |
 *                                |               |
 *                                 ---------------
 **/

for (const dummyEvent of dummyCallbackEvents) {
  const aggregateNode = aggregateNodes.get(dummyEvent.aggregateId)
  if (!aggregateNode.sources) aggregateNode.sources = []
  aggregateNode.sources.push({
    init: dummyEvent.delayStart,
    before: [dummyEvent.before],
    after: [dummyEvent.after],
    // .destroy isn't currently used in these tests or defined in test data,
    // if it's undefined give it a valid random value for completeness
    destroy: dummyEvent.destroy || dummyEvent.after + Math.random()
  })
}

for (const [clusterId, clusterNode] of clusterNodes) {
  for (let i = 0; i < clusterNode.nodes.length; i++) {
    const aggregateId = clusterNode.nodes[i]
    clusterNode.nodes[i] = aggregateNodes.get(aggregateId)
    clusterNode.id = clusterNode.clusterId = clusterId
    clusterNode.mark = new Map([['party', 'user']])
    if (clusterNode.parentClusterId) {
      const parentNode = clusterNodes.get(clusterNode.parentClusterId)
      if (!parentNode.children) parentNode.children = []
      if (!parentNode.children.includes(clusterId)) parentNode.children.push(clusterId)
    }
  }
}

for (const [aggregateId, aggregateNode] of aggregateNodes) {
  aggregateNode.id = aggregateNode.aggregateId = aggregateId
}

const clusterNodesArray = [...clusterNodes.values()]
const aggregateNodesArray = [...aggregateNodes.values()]

module.exports = {
  clusterNodesArray,
  aggregateNodesArray
}
