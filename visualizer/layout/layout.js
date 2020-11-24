'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ShortcutNode } = require('../data/data-node.js')
const { LayoutNode } = require('./layout-node.js')
const CollapsedLayout = require('./collapsed-layout.js')

class Layout {
  constructor ({ dataNodes, connection, parentLayout }, settings) {
    const defaultSettings = {
      collapseNodes: false,
      svgDistanceFromEdge: 40,
      lineWidth: 2,
      labelMinimumSpace: 10,
      svgWidth: 750,
      svgHeight: 750,
      shortcutLength: 60,
      allowStretch: true,

      // A static window height is used for node collapsing, so view contents are consistent regardless of window size etc
      // 680 is based on common window sizes and tested to give reasonable collapsing
      sizeIndependentHeight: 680,
      initialCollapseThreshold: 10,
      debugMode: false
    }
    this.settings = Object.assign(defaultSettings, settings)
    this.initialInput = {
      dataNodes,
      connection,
      parentLayout
    }

    this.parentLayout = parentLayout || null

    this.scale = new Scale(this)
    this.positioning = new Positioning(this)

    this.connections = []
    this.connectionsByTargetId = new Map()

    this.rootLayoutNode = null

    if (connection) {
      this.prepareSublayoutNodes(dataNodes, connection)
    } else {
      this.prepareLayoutNodes(dataNodes)
    }
  }

  // Note: This currently does not support missing midpoints (implicit children)
  prepareLayoutNodes (dataNodes) {
    this.layoutNodes = new Map()

    const dataNodeById = new Map(dataNodes.map(node => [node.id, node]))

    const nodesByTreeOrder = dataNodes.filter(dataNode => !dataNode.parent).map(dataNode => {
      return {
        id: dataNode.id,
        parent: null
      }
    })

    // Traverse through the tree depth-first, without recursion because depths (initial chain lengths) are unbounded.
    // For example, cluster nodes could contain aggregate node chains of any length before collapse logic applies.
    while (nodesByTreeOrder.length) {
      const {
        id,
        parent
      } = nodesByTreeOrder.shift()

      const dataNode = dataNodeById.get(id)
      if (!dataNode || this.layoutNodes.has(id)) continue

      const layoutNode = new LayoutNode(dataNode, parent)
      this.layoutNodes.set(id, layoutNode)

      if (dataNode.isRoot) this.rootLayoutNode = this.layoutNodes.get(id)
      if (parent) parent.children.push(id)

      // First children and their descendents first (iterate children backwards, queue each next in array)
      for (let i = dataNode.children.length; i >= 0; i--) {
        nodesByTreeOrder.unshift({
          id: dataNode.children[i],
          parent: layoutNode
        })
      }
    }
  }

  // For layouts inside a clusterNode, rather than layouts of all cluterNodes
  prepareSublayoutNodes (dataNodes, connection) {
    // This sublayout is of nodes within targetNode. Some have parents within originNode

    const includedIds = new Set(dataNodes.map(dataNode => dataNode.id))

    const shortcutToOrigin = !connection.originNode
      ? null
      : new ShortcutNode({
        id: `shortcut:${connection.originNode.id}`,
        isRoot: true,
        children: []
      }, connection.originNode)

    if (shortcutToOrigin) {
      dataNodes.unshift(shortcutToOrigin)
    }

    for (let i = 0; i < dataNodes.length; ++i) {
      const dataNode = dataNodes[i]

      if (shortcutToOrigin && !includedIds.has(dataNode.parentId)) {
        shortcutToOrigin.children.push(dataNode.id)
      }
      for (let i = 0; i < dataNode.children.length; ++i) {
        const childId = dataNode.children[i]
        // If this child is in another cluster, add a dummy leaf node -> clickable link/shortcut to that cluster
        if (!dataNodes.some(dataNode => dataNode.id === childId)) {
          const childNode = dataNode.getSameType(childId)

          // If we're inside a cluster of clusters, childNode might be on the top level of clusters
          const shortcutNode = new ShortcutNode({
            id: childId, // id in another cluster - can't be duplicated in this layout, is in parent's children array
            children: [],
            parentId: dataNode.id
          // Use the name, mark etc of the clusterNode the target node is inside
          }, childNode.clusterId ? childNode : childNode.clusterNode)

          dataNodes.push(shortcutNode)
        }
      }
    }
    this.prepareLayoutNodes(dataNodes)
  }

  // Returns a containing layoutNode. If dataNode can't be found at this level and
  // `recursive` is true, it walks up parent layouts and re-tries; else it returns false
  findDataNode (dataNode, recursive = false) {
    const nodeId = dataNode.id
    const layoutNodes = this.layoutNodes
    if (layoutNodes.has(nodeId) && layoutNodes.get(nodeId).node.uid === dataNode.uid) {
      return this.layoutNodes.get(nodeId)
    }
    if (dataNode.contents) {
      return this.findDataNode(dataNode.contents[0])
    }
    return this.findCollapsedNode(dataNode, recursive)
  }

  findCollapsedNode (dataNode, recursive = false) {
    for (const layoutNode of this.layoutNodes.values()) {
      if (layoutNode.collapsedNodes && layoutNode.collapsedNodes.some((subLayoutNode) => subLayoutNode.node.uid === dataNode.uid)) {
        return layoutNode
      }
    }
    return recursive && this.parentLayout ? this.parentLayout.findDataNode(dataNode, recursive) : false
  }

  findAggregateNode (aggregateNode, recursive = false) {
    return this.findDataNode(aggregateNode, recursive) || this.findDataNode(aggregateNode.clusterNode, recursive)
  }

  processBetweenData (generateConnections = true) {
    // If re-doing after scale, remove old pre-scale pre-collapse stems
    if (generateConnections) this.layoutNodes.forEach(layoutNode => { layoutNode.stem = null })

    const layoutNodesIterator = this.layoutNodes.values()
    for (let i = 0; i < this.layoutNodes.size; ++i) {
      const layoutNode = layoutNodesIterator.next().value

      // Missing ancestor stems are created within descendents' new Stem, so stem might already exist
      if (!layoutNode.stem) layoutNode.stem = new Stem(this, layoutNode)

      if (generateConnections && layoutNode.parent) {
        const connection = new Connection(layoutNode.parent, layoutNode, this.scale)
        this.connectionsByTargetId.set(layoutNode.id, connection)
        this.connections.push(connection)
        layoutNode.inboundConnection = connection
      }
    }
  }

  processHierarchy (settingsOverride) {
    const settings = settingsOverride || this.settings

    this.processBetweenData(!settings.collapseNodes)
    this.updateScale()
    if (settings.collapseNodes) {
      this.collapseNodes()
      this.processBetweenData(true)
      this.updateScale(true)
    }
  }

  updateScale (collapsed = false) {
    this.scale.calculatePreScaleFactor(collapsed)
    this.updateStems()
    this.scale.calculateScaleFactor(collapsed)
    this.updateStems()
    const wasAdjusted = this.scale.adjustScaleFactor(collapsed)
    if (wasAdjusted) this.updateStems()
  }

  updateStems () {
    const layoutNodesIterator = this.layoutNodes.values()
    for (let i = 0; i < this.layoutNodes.size; ++i) {
      const layoutNode = layoutNodesIterator.next().value
      layoutNode.stem.update()
    }
  }

  createSubLayout (layoutNode, settings) {
    const subsetInView = pickDataSubset(layoutNode)

    if (subsetInView.length) {
      const connection = layoutNode.inboundConnection

      const sublayout = new Layout({
        parentLayout: this,
        dataNodes: subsetInView,
        connection: connection || { targetNode: layoutNode.node }
      }, settings)
      return sublayout
    }
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate (settingsOverride) {
    this.processHierarchy(settingsOverride)
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }

  collapseNodes () {
    const collapsedLayout = new CollapsedLayout(this)
    this.layoutNodes = collapsedLayout.layoutNodes
    if (this.settings.debugMode) this.collapsedLayout = collapsedLayout
  }

  getLayoutNodeSorter () {
    // Returns a sorting function that accesses layout.positioning without `this`
    const positioning = this.positioning
    return (a, b) => {
      const aDepth = a.stem.ancestors.ids.length
      const bDepth = b.stem.ancestors.ids.length

      // If the layoutNodes are at different depths, sort by depth (number of ancestors including layout root)
      if (aDepth !== bDepth) {
        return aDepth - bDepth
      }

      // If they are at same depth and positioning is complete, use left-to-right draw order based on positioning.order's leaf ID order
      if (positioning && positioning.order) {
        // A midpoint may have many leaves, but leaves bunch by stems. Comparing first with first == comparing bunch with bunch
        const aFirstLeafId = a.stem.leaves.ids.length ? a.stem.leaves.ids[0] : a.id
        const bFirstLeafId = b.stem.leaves.ids.length ? b.stem.leaves.ids[0] : b.id

        const aFirstLeafIndex = positioning.order.indexOf(aFirstLeafId)
        const bFirstLeafIndex = positioning.order.indexOf(bFirstLeafId)
        return aFirstLeafIndex - bFirstLeafIndex
      }

      // If they are at same depth but positioning is incomplete, sort by id ~= earlier first
      return a.id - b.id
    }
  }

  getSortedLayoutNodes () {
    return [...this.layoutNodes.values()].sort(this.getLayoutNodeSorter())
  }
}

function pickDataSubset (layoutNode) {
  // Use collapsed
  if (layoutNode.collapsedNodes) {
    return layoutNode.collapsedNodes.map(hiddenLayoutNode => hiddenLayoutNode.node)
  }
  // Use aggregates
  return [...layoutNode.node.nodes.values()]
}

module.exports = Layout
