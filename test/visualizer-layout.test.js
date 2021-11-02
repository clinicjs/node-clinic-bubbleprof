'use strict'

const test = require('tap').test
const loadData = require('../visualizer/data/index.js')
const Layout = require('../visualizer/layout/layout.js')
const generateLayout = require('../visualizer/layout/index.js')

const { mockTopology } = require('./visualizer-util/fake-topology.js')

function toLink (layout, layoutNode) {
  const strayChildren = layoutNode.children.map(childId => layout.layoutNodes.get(childId)).filter(child => child.parent !== layoutNode)
  if (strayChildren.length) {
    throw new Error(`layoutNode ${layoutNode.id} has stray children: [${strayChildren.map(toParentLink).join(', ')}]`)
  }
  return layoutNode.id + ' => ' + layoutNode.children.join(';')
}

function toParentLink (layoutNode) {
  const parentId = (layoutNode.parent && layoutNode.parent.id) || ''
  return parentId + ' <= ' + layoutNode.id
}

function createLinkValidator (layout) {
  return (layoutNode) => toLink(layout, layoutNode)
}

function toTypeId (layoutNode) {
  return layoutNode.node.constructor.name + '-' + layoutNode.id
}

const dataSettings = {
  debugMode: true
}

const settings = Object.assign({
  svgWidth: 1000,
  svgHeight: 1000,
  labelMinimumSpace: 0,
  lineWidth: 0,
  svgDistanceFromEdge: 30,
  collapseNodes: true
}, dataSettings)

test('Visualizer layout - builds sublayout from connection', function (t) {
  const topology = [
    ['1.2.3.4.5', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const initialDataNodes = [...dataSet.clusterNodes.values()]
  const uncollapsedSettings = Object.assign({ collapseNodes: false }, settings)
  const initialLayout = new Layout({ dataNodes: initialDataNodes }, uncollapsedSettings)
  initialLayout.processBetweenData()
  const traversedLayoutNode = initialLayout.layoutNodes.get(4)
  const traversedLayout = initialLayout.createSubLayout(traversedLayoutNode, uncollapsedSettings)
  t.equal(traversedLayout.parentLayout.rootLayoutNode.id, initialLayout.rootLayoutNode.id)
  const toValidLink = createLinkValidator(traversedLayout)
  t.same([...traversedLayout.layoutNodes.values()].map(toTypeId), ['ShortcutNode-shortcut:3', 'AggregateNode-4', 'ShortcutNode-5'])
  t.same([...traversedLayout.layoutNodes.values()].map(toValidLink), ['shortcut:3 => 4', '4 => 5', '5 => '])

  t.end()
})

// R=Root / Top Node, T=Tiny, L=Long, C=Collapsed, P=Tiny Parent Of Long

// R->T->T->P->L gives R->C->P->L
test('Visualizer layout - collapse - collapses vertically (except root and Ps)', function (t) {
  const topology = [
    ['1.2.3.4.5', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3', '3 => 4', '4 => 5', '5 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => x1', 'x1 => 4', '4 => 5', '5 => '])
  t.same([2, 3], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))

  t.throws(() => {
    const brokenLayout = new Layout({ dataNodes }, settings)
    // Break the layout by giving a node a parent that isn't even in this layout
    brokenLayout.layoutNodes.get(3).parent = layout.layoutNodes.get(2)
    brokenLayout.generate()
  }, new Error('Cannot combine nodes - clump/stem mismatch: 1=>2 + 3'))

  t.end()
})

test('Visualizer layout - collapse - does not collapse shortcut nodes', function (t) {
  const topology = [
    ['1.2.3', 1],
    ['1.2.4', 1],
    ['1.2.5', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const initialDataNodes = [...dataSet.clusterNodes.values()]
  const initialLayout = new Layout({ dataNodes: initialDataNodes }, settings)
  initialLayout.processHierarchy()
  const traversedLayoutNode = initialLayout.layoutNodes.get(2)
  const traversedLayout = initialLayout.createSubLayout(traversedLayoutNode, settings)
  traversedLayout.processHierarchy()
  t.same([...traversedLayout.layoutNodes.values()].map(toTypeId), ['ShortcutNode-shortcut:1', 'AggregateNode-2', 'ShortcutNode-3', 'ShortcutNode-4', 'ShortcutNode-5'])

  t.end()
})

test('Visualizer layout - collapse - merges shortcuts pointing to the same view', function (t) {
  const topology = [
    ['1.2.3.4.5', 1],
    ['1.2.3.6.7', 1],
    ['1.2.3.8.9', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const initialDataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(2).stats.async.between = 100 // make 2 long
  dataSet.clusterNodes.get(3).stats.async.between = 100 // make 3 long
  dataSet.clusterNodes.get(5).stats.async.between = 100 // make 5 long
  dataSet.clusterNodes.get(7).stats.async.between = 100 // make 7 long
  dataSet.clusterNodes.get(9).stats.async.between = 100 // make 9 long
  const initialLayout = new Layout({ dataNodes: initialDataNodes }, settings)
  initialLayout.processHierarchy()
  let toValidLink = createLinkValidator(initialLayout)
  t.same([...initialLayout.layoutNodes.values()].map(toTypeId), ['ClusterNode-1', 'ClusterNode-2', 'ClusterNode-3', 'ArtificialNode-x2', 'ClusterNode-5', 'ClusterNode-7', 'ClusterNode-9'])
  t.same([...initialLayout.layoutNodes.values()].map(toValidLink), ['1 => 2', '2 => 3', '3 => x2', 'x2 => 5;7;9', '5 => ', '7 => ', '9 => '])
  const traversedLayoutNode = initialLayout.layoutNodes.get(3)
  const traversedLayout = initialLayout.createSubLayout(traversedLayoutNode, settings)
  traversedLayout.processHierarchy()
  toValidLink = createLinkValidator(traversedLayout)
  t.same([...traversedLayout.layoutNodes.values()].map(toTypeId), ['ShortcutNode-shortcut:2', 'AggregateNode-3', 'ShortcutNode-shortcut:x2'])
  t.same([...traversedLayout.layoutNodes.values()].map(toValidLink), ['shortcut:2 => 3', '3 => shortcut:x2', 'shortcut:x2 => '])
  t.ok(initialLayout.ejectedLayoutNodeIds.includes('x1'))

  t.end()
})

// R->T->T->P->L->T->T->P->L gives R->C->P->L->C->P->L
test('Visualizer layout - collapse - collapses vertically with break (except root and Ps)', function (t) {
  const topology = [
    ['1.2.3.4.5.6.7.8.9', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(5).stats.async.between = 100 // make 5 long
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3', '3 => 4', '4 => 5', '5 => 6', '6 => 7', '7 => 8', '8 => 9', '9 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => x2', 'x2 => 4', '4 => 5', '5 => x1', 'x1 => 8', '8 => 9', '9 => '])
  t.same([6, 7], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))
  t.same([2, 3], layout.layoutNodes.get('x2').collapsedNodes.map(layoutNode => layoutNode.id))

  t.end()
})

// LR->T->T->T->T gives LR->C->T
test('Visualizer layout - collapse - collapses vertically until minimum count threshold is hit', function (t) {
  const topology = [
    ['1.2.3.4.5', 1],
    ['1.2.3.4.6', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1000 // make root long
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3', '3 => 4', '4 => 5;6', '5 => ', '6 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => 2', '2 => x1', 'x1 => '])
  t.same([3, 4, 5, 6], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))

  t.end()
})

// R->L->P->L
//     \>L->L
//     \>P->L
// gives
// R->L->C->L
//    |   \>L
//     \>L->L
test('Visualizer layout - collapse - collapses horizontally', function (t) {
  const topology = [
    ['1.2.3.4', 100],
    ['1.2.5.6', 100],
    ['1.2.7.8', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(2).stats.async.between = 100 // make 2 long
  dataSet.clusterNodes.get(5).stats.async.between = 100 // make 5 long
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3;5;7', '3 => 4', '4 => ', '5 => 6', '6 => ', '7 => 8', '8 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => 2', '2 => x1;5', 'x1 => 4;8', '4 => ', '8 => ', '5 => 6', '6 => '])
  t.same([3, 7], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))

  t.end()
})

// R->T->T->P->L
//     \>T->P->L
// gives
// R->C->P->L
//     \>P->L
// TODO: support horizontal collapsing between children of collapsed nodes, i.e. merge the Ps in this scenario
test('Visualizer layout - collapse - collapses both horizontally and vertically (except root and Ps)', function (t) {
  const topology = [
    ['1.2.3.4.5', 100],
    ['1.2.6.7.8', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3;6', '3 => 4', '4 => 5', '5 => ', '6 => 7', '7 => 8', '8 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => x2', 'x2 => 4;7', '4 => 5', '5 => ', '7 => 8', '8 => '])
  t.same([2, 3, 6], layout.layoutNodes.get('x2').collapsedNodes.map(layoutNode => layoutNode.id))

  t.ok(layout.ejectedLayoutNodeIds.includes('x1'))

  t.end()
})

// ?->R->T->T->P->L
// ?\>R->P->L->L
// gives
// ?->R->C->P->L
// ?\>R->P->L->L
test('Visualizer layout - collapse - vertically collapses subset with missing root (except top nodes and Ps)', function (t) {
  const topology = [
    ['1.2.3.4.5.6', 100],
    ['1.7.8.9.10', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  dataSet.clusterNodes.get(9).stats.async.within = 100 // make 9 long
  const subset = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(nodeId => dataSet.clusterNodes.get(nodeId))
  const layout = new Layout({ dataNodes: subset }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  const sortedBefore = layout.getSortedLayoutNodes().map(toValidLink)
  t.same(actualBefore, ['2 => 3', '3 => 4', '4 => 5', '5 => 6', '6 => ', '7 => 8', '8 => 9', '9 => 10', '10 => '])
  t.same(sortedBefore, ['2 => 3', '7 => 8', '3 => 4', '8 => 9', '4 => 5', '9 => 10', '5 => 6', '10 => ', '6 => '])

  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  const sortedAfter = layout.getSortedLayoutNodes().map(toValidLink)
  t.same(actualAfter, ['2 => x1', 'x1 => 5', '5 => 6', '6 => ', '7 => 8', '8 => 9', '9 => 10', '10 => '])
  t.same(sortedAfter, ['2 => x1', '7 => 8', 'x1 => 5', '8 => 9', '5 => 6', '9 => 10', '6 => ', '10 => '])
  t.same([3, 4], layout.layoutNodes.get('x1').collapsedNodes.map(layoutNode => layoutNode.id))

  t.end()
})

// R->T->T->T->?
//     \>P->L->?
// gives
// R->T->C->L
test('Visualizer layout - collapse - collapses subset both vertically and horizontally with missing leaves (except root and Ps)', function (t) {
  const topology = [
    ['1.2.3.4.5', 100],
    ['1.2.6.7.8', 100]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(7).stats.async.between = 100 // make 7 long
  const subset = [1, 2, 3, 4, 6, 7].map(nodeId => dataSet.clusterNodes.get(nodeId)) // drop 5 and 8
  const layout = new Layout({ dataNodes: subset }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2', '2 => 3;6', '3 => 4', '4 => ', '6 => 7', '7 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => 2', '2 => x2', 'x2 => 7', '7 => '])
  t.same([3, 6, 4], layout.layoutNodes.get('x2').collapsedNodes.map(layoutNode => layoutNode.id))
  t.ok(layout.ejectedLayoutNodeIds.includes('x1'))

  t.end()
})

// T->L
//  \>L->T
//     \>T->T
//     \>T->T
//        \>T
//     \>L->T
//        \>T->T
// gives
// T->L
//  \>L->C
//     \>L->C
test('Visualizer layout - collapse - complex example', function (t) {
  const topology = [
    ['1.2', 100],
    ['1.3.4', 1],
    ['1.3.5.6', 1],
    ['1.3.7.8', 1],
    ['1.3.7.9', 1],
    ['1.3.10.11', 1],
    ['1.3.10.12.13', 1]
  ]
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const dataNodes = [...dataSet.clusterNodes.values()]
  dataSet.clusterNodes.get(1).stats.async.within = 1 // make root short
  dataSet.clusterNodes.get(2).stats.async.within = 100 // make 2 long
  dataSet.clusterNodes.get(3).stats.async.within = 100 // make 3 long
  dataSet.clusterNodes.get(10).stats.async.within = 100 // make 10 long
  const layout = new Layout({ dataNodes }, settings)
  layout.processBetweenData()
  layout.updateScale()
  const toValidLink = createLinkValidator(layout)
  const actualBefore = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualBefore, ['1 => 2;3', '2 => ', '3 => 4;5;7;10', '4 => ', '5 => 6', '6 => ', '7 => 8;9', '8 => ', '9 => ', '10 => 11;12', '11 => ', '12 => 13', '13 => '])
  layout.collapseNodes()
  layout.processBetweenData()
  layout.updateScale()
  const actualAfter = [...layout.layoutNodes.values()].map(toValidLink)
  t.same(actualAfter, ['1 => 2;3', '2 => ', '3 => x3;10', 'x3 => ', '10 => x2', 'x2 => '])
  t.same([11, 12, 13], layout.layoutNodes.get('x2').collapsedNodes.map(layoutNode => layoutNode.id))
  t.same([4, 5, 7, 6, 8, 9], layout.layoutNodes.get('x3').collapsedNodes.map(layoutNode => layoutNode.id))

  t.ok(layout.ejectedLayoutNodeIds.includes('x1'))

  t.end()
})

test('Visualizer layout - collapse - naming', function (t) {
  const topology = [
    ['1.2', 200],
    ['1.3', 2],
    ['1.4', 2],
    ['1.5', 2],
    ['1.6', 3],
    ['1.7', 3],
    ['1.8', 3],
    ['1.9', 200],
    ['1.9.10', 200],
    ['1.9.11', 200],
    ['1.9.12', 200],
    ['1.9.13', 200],
    ['1.9.14', 200]
  ]

  let layout
  const dataSet = loadData(dataSettings, mockTopology(topology))
  const partiesById = {
    3: 'user',
    4: 'external',
    5: 'nodecore',
    6: 'user',
    7: 'external',
    8: 'nodecore'
  }

  function getNamedClusterNodes (dataSet, namesById) {
    for (const [clusterId, clusterNode] of dataSet.clusterNodes) {
      clusterNode.name = namesById[clusterId]
      clusterNode.mark.set('party', partiesById[clusterId])
    }
    return dataSet
  }

  // Simple unique names
  layout = generateLayout(getNamedClusterNodes(dataSet, {
    3: 'a',
    4: 'b',
    5: 'c',
    6: 'd',
    7: 'e',
    8: 'f'
  }), settings)
  t.equal(layout.layoutNodes.get('x1').node.name, 'd & a & e & b & f & c')

  // Stop adding names if string is already over 24 chars
  layout = generateLayout(getNamedClusterNodes(dataSet, {
    3: 'aaaaaa',
    4: 'bbbbbb',
    5: 'cccccc',
    6: 'dddddd',
    7: 'eeeeee',
    8: 'ffffff'
  }), settings)
  t.equal(layout.layoutNodes.get('x1').node.name, 'dddddd & aaaaaa & eeeeee & …')

  // Combine duplicate names - lifts c off the bottom
  layout = generateLayout(getNamedClusterNodes(dataSet, {
    3: 'a',
    4: 'b',
    5: 'c',
    6: 'd',
    7: 'e',
    8: 'c'
  }), settings)
  t.equal(layout.layoutNodes.get('x1').node.name, 'd & a & e & c & b')

  // Pick first of multi part names unless it's already featured
  layout = generateLayout(getNamedClusterNodes(dataSet, {
    3: 'a > a > a',
    4: 'b/e + bb',
    5: 'a > b > d',
    6: '... > d > d',
    7: 'b/e + ee',
    8: 'a > b > d'
  }), settings)
  // a… appears twice because everything in 'a > b > d' was already in the name, so falls back to [0]
  t.equal(layout.layoutNodes.get('x1').node.name, '…d… & a… & b/e… & a… & …bb')

  t.end()
})
