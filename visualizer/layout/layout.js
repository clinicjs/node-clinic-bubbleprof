'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ShortcutNode } = require('../data/data-node.js')
const CollapsedLayout = require('./collapsed-layout.js')

class Layout {
  constructor ({ dataNodes, connection, parentLayout }, settings) {
    const defaultSettings = {
      collapseNodes: false,
      svgDistanceFromEdge: 30,
      lineWidth: 1.5,
      labelMinimumSpace: 12,
      svgWidth: 750,
      svgHeight: 750,
      allowStretch: true
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
    const createLayoutNode = (nodeId, parentLayoutNode) => {
      const dataNode = dataNodeById.get(nodeId)
      if (!dataNode || this.layoutNodes.has(dataNode.id)) return

      const layoutNode = new LayoutNode(dataNode, parentLayoutNode)
      this.layoutNodes.set(dataNode.id, layoutNode)

      if (dataNode.isRoot) this.rootLayoutNode = this.layoutNodes.get(dataNode.id)

      if (parentLayoutNode) parentLayoutNode.children.push(dataNode.id)
      for (let i = 0; i < dataNode.children.length; ++i) {
        const childNodeId = dataNode.children[i]
        createLayoutNode(childNodeId, layoutNode)
      }
    }
    const topDataNodes = dataNodes.filter(dataNode => !dataNode.parent)
    for (let i = 0; i < topDataNodes.length; ++i) {
      const topDataNode = topDataNodes[i]
      createLayoutNode(topDataNode.id)
    }
  }

  // For layouts inside a clusterNode, rather than layouts of all cluterNodes
  prepareSublayoutNodes (dataNodes, connection) {
    // This sublayout is of nodes within targetNode. Some have parents within sourceNode

    const includedIds = new Set(dataNodes.map(dataNode => dataNode.id))

    const shortcutToSource = !connection.sourceNode ? null : new ShortcutNode({
      id: connection.sourceNode.id,
      isRoot: true,
      children: []
    }, connection.sourceNode)

    if (shortcutToSource) {
      dataNodes.unshift(shortcutToSource)
    }

    for (let i = 0; i < dataNodes.length; ++i) {
      const dataNode = dataNodes[i]

      if (shortcutToSource && !includedIds.has(dataNode.parentId)) {
        shortcutToSource.children.push(dataNode.id)
      }
      for (let i = 0; i < dataNode.children.length; ++i) {
        const childId = dataNode.children[i]
        // If this child is in another cluster, add a dummy leaf node -> clickable link/shortcut to that cluster
        if (!dataNodes.some(dataNode => dataNode.id === childId)) {
          const childNode = dataNode.getSameType(childId)

          // If we're inside a cluster of clusters, childNode might be on the top level of clusters
          const shortcutNode = new ShortcutNode({
            id: childId,
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
    if (layoutNodes.has(nodeId) && layoutNodes.get(nodeId).node === dataNode) {
      return this.layoutNodes.get(nodeId)
    }
    return this.findCollapsedNode(dataNode, recursive)
  }

  findCollapsedNode (dataNode, recursive = false) {
    for (const layoutNode of this.layoutNodes.values()) {
      if (layoutNode.collapsedNodes && layoutNode.collapsedNodes.some((subLayoutNode) => subLayoutNode.node === dataNode)) {
        return layoutNode
      }
    }
    return recursive && this.parentLayout ? this.parentLayout.findDataNode(dataNode, recursive) : false
  }

  findAggregateNode (aggregateNode, recursive = false) {
    return this.findDataNode(aggregateNode, recursive) || this.findDataNode(aggregateNode.clusterNode, recursive)
  }

  processBetweenData (generateConnections = true) {
    const layoutNodesIterator = this.layoutNodes.values()
    for (let i = 0; i < this.layoutNodes.size; ++i) {
      const layoutNode = layoutNodesIterator.next().value
      layoutNode.stem = new Stem(this, layoutNode)

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
      this.updateScale()
    }
  }

  updateScale () {
    this.scale.calculatePreScaleFactor()
    this.updateStems()
    this.scale.calculateScaleFactor()
    this.updateStems()
  }

  updateStems () {
    const layoutNodesIterator = this.layoutNodes.values()
    for (let i = 0; i < this.layoutNodes.size; ++i) {
      const layoutNode = layoutNodesIterator.next().value
      layoutNode.stem.update()
    }
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate (settingsOverride) {
    this.processHierarchy(settingsOverride)
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }

  collapseNodes () {
    const collapsedLayout = new CollapsedLayout(this.layoutNodes, this.scale)
    this.layoutNodes = collapsedLayout.layoutNodes
  }
}

class LayoutNode {
  constructor (node, parent) {
    this.id = node.id
    this.node = node
    this.stem = null
    this.position = null
    this.inboundConnection = null
    this.parent = parent
    this.children = []
  }
  getBetweenTime () {
    return this.node.getBetweenTime()
  }
  getWithinTime () {
    return this.node.getWithinTime()
  }
  getTotalTime () {
    return this.getBetweenTime() + this.getWithinTime()
  }
  validateStat (...args) {
    return this.node.validateStat(...args)
  }
}

module.exports = Layout
