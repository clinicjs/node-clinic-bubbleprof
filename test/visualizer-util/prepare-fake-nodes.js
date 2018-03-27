const {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents,
  expectedClusterResults,
  expectedAggregateResults
} = require('./fake-overlapping-nodes.js')

class TestClusterNode {
  constructor (clusterId) {
    const clusterNode = clusterNodes.get(clusterId)
    Object.assign(this, clusterNode)
    this.id = this.clusterId = clusterId
  }
}

class TestAggregateNode {
  constructor (aggregateId) {
    Object.assign(this, aggregateNodes.get(aggregateId))
    this.id = this.aggregateId = aggregateId
    this.mark = this.mark || ['dummy', undefined, undefined]
    this.frames = this.frames || []
    this.type = this.type || 'dummyType'
    this.sources = []
  }
}

const fakeNodes = []

for (const [aggregateId] of aggregateNodes) {
  aggregateNodes.set(aggregateId, new TestAggregateNode(aggregateId))
}

for (const [clusterId, clusterNode] of clusterNodes) {
  for (var i = 0; i < clusterNode.nodes.length; i++) {
    const aggregateId = clusterNode.nodes[i]
    clusterNode.nodes[i] = aggregateNodes.get(aggregateId)
  }
  clusterNodes.set(clusterId, new TestClusterNode(clusterId))
  fakeNodes.push(clusterNodes.get(clusterId))
}

for (const dummyEvent of dummyCallbackEvents) {
  const aggregateNode = aggregateNodes.get(dummyEvent.aggregateId)
  if (typeof dummyEvent.sourceKey !== 'undefined') {
    // Add this to an existing source
    const source = aggregateNode.sources[dummyEvent.sourceKey]
    source.before.push(dummyEvent.before)
    source.after.push(dummyEvent.after)
  } else {
    // Create a new source
    aggregateNode.sources.push({
      init: dummyEvent.delayStart,
      before: [dummyEvent.before],
      after: [dummyEvent.after],
      // .destroy isn't currently used in these tests or defined in test data,
      // if it's undefined give it a valid random value for completeness
      destroy: dummyEvent.destroy || dummyEvent.after + Math.random()
    })
  }
}

module.exports = {
  fakeNodes,
  expectedClusterResults,
  expectedAggregateResults
}
