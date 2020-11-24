const {
  clusterNodes,
  aggregateNodes,
  dummyCallbackEvents,
  expectedClusterResults,
  expectedAggregateResults,
  expectedTypeCategories,
  expectedTypeSubCategories,
  expectedDecimalsTo5Places
} = require('./fake-overlapping-nodes.js')

class TestClusterNode {
  constructor (clusterId) {
    const clusterNode = clusterNodes.get(clusterId)
    Object.assign(this, clusterNode)
    this.id = this.clusterId = clusterId
    this.mark = new Map([['party', 'user']])
  }
}

class TestAggregateNode {
  constructor (aggregateId) {
    Object.assign(this, aggregateNodes.get(aggregateId))
    this.id = this.aggregateId = aggregateId
    this.frames = this.frames || []
    this.sources = []
  }
}

const fakeNodes = []

for (const [aggregateId] of aggregateNodes) {
  aggregateNodes.set(aggregateId, new TestAggregateNode(aggregateId))
}

for (const [clusterId, clusterNode] of clusterNodes) {
  for (let i = 0; i < clusterNode.nodes.length; i++) {
    const aggregateId = clusterNode.nodes[i]
    clusterNode.nodes[i] = aggregateNodes.get(aggregateId)
  }
  clusterNodes.set(clusterId, new TestClusterNode(clusterId))
  fakeNodes.push(clusterNodes.get(clusterId))
}

let asyncId = 0 // Give root node asyncId 0 so first 'real' node gets 1

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
      asyncId,
      init: dummyEvent.delayStart,
      before: [dummyEvent.before],
      after: [dummyEvent.after],
      // .destroy isn't currently used in these tests or defined in test data,
      // if it's undefined give it a valid random value for completeness
      destroy: dummyEvent.destroy || dummyEvent.after + Math.random()
    })
    asyncId++
  }
}

// Attach pre-computed withins to fake ClusterNodes
for (const expected of expectedClusterResults.values()) {
  expected.withinValue = expected.async.within + expected.sync
}

// Attach pre-computed withins to fake AggregateNodes
for (const expected of expectedAggregateResults.values()) {
  expected.withinValue = expected.sync
}

module.exports = {
  fakeNodes,
  expectedClusterResults,
  expectedAggregateResults,
  expectedTypeCategories,
  expectedTypeSubCategories,
  expectedDecimalsTo5Places
}
