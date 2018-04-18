'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ClusterNode } = require('../data/data-node.js')

class Layout {
  constructor ({ dataNodes, connection }, settings, collapseNodes = false) {
    const defaultSettings = {
      svgWidth: 1000,
      svgHeight: 1000,
      svgDistanceFromEdge: 30,
      // lineWidth and labelMinimumSpace will usually be passed in from UI settings
      lineWidth: 2,
      labelMinimumSpace: 14
    }
    this.settings = Object.assign(defaultSettings, settings)

    // TODO: re-evaluate this, does it still make sense to initialise these now?
    this.scale = new Scale(this)
    this.positioning = new Positioning(this)

    this.connections = []
    this.connectionsByTargetId = new Map()

    this.layoutNodes = new Map()

    if (connection) {
      this.prepareSublayoutNodes(dataNodes, connection)
    } else {
      this.prepareLayoutNodes(dataNodes)
    }
  }

  prepareLayoutNodes (dataNodes) {
    const dataNodeById = new Map(dataNodes.map(node => [node.id, node]))
    const createLayoutNode = (nodeId, parentLayoutNode) => {
      const dataNode = dataNodeById.get(nodeId)
      if (this.layoutNodes.has(dataNode.id)) return

      const layoutNode = new LayoutNode(dataNode, parentLayoutNode)
      this.layoutNodes.set(dataNode.id, layoutNode)

      if (parentLayoutNode) parentLayoutNode.children.push(dataNode.id)
      for (const childNodeId of dataNode.children) {
        createLayoutNode(childNodeId, layoutNode)
      }
    }
    createLayoutNode(dataNodes[0].id)
  }

  // For layouts inside a clusterNode, rather than layouts of all cluterNodes
  prepareSublayoutNodes (dataNodes, connection) {
    // This sublayout is of nodes within targetNode. Some have parents within sourceNode
    const linkToSource = !connection ? null : new ArtificialNode({
      id: connection.sourceNode.id,
      isRoot: true,
      children: []
    }, connection.sourceNode)

    if (linkToSource) {
      dataNodes.unshift(linkToSource)
    }

    // let nodeType // TODO: see if this is necessary when clusters-of-clusters are implemented
    for (const dataNode of dataNodes) {
      // if (!nodeType) nodeType = node.constructor.name

      if (linkToSource && dataNode.isBetweenClusters) {
        linkToSource.children.push(dataNode.id)
      }
      for (const childId of dataNode.children) {
        // If this child is in another cluster, add a dummy leaf node -> clickable link to that cluster
        if (!dataNodes.some(dataNode => dataNode.id === childId)) {
          const childNode = dataNode.getSameType(childId)

          // If we're inside a cluster of clusters, childNode might be on the top level of clusters
          const linkOnwards = new ArtificialNode({
            id: childId,
            children: [],
            parentId: dataNode.id
          }, childNode)

          dataNodes.push(linkOnwards)
        }
      }
    }
    this.prepareLayoutNodes(dataNodes)
  }

  processBetweenData () {
    for (const layoutNode of this.layoutNodes.values()) {
      layoutNode.stem = new Stem(this, layoutNode)

      if (layoutNode.parent) {
        const connection = new Connection(layoutNode.parent, layoutNode, this.scale)
        this.connectionsByTargetId.set(layoutNode.id, connection)
        this.connections.push(connection)
        layoutNode.inboundConnection = connection
      }
    }
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate () {
    this.processBetweenData()
    this.scale.calculateScaleFactor()
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }
  static collapseNodes (nodes, scale) {
    // TODO: rework this
    const subsetNodeById = {}
    for (const node of nodes) {
      subsetNodeById[node.id] = node
    }
    const topNodes = nodes.filter(node => !subsetNodeById[node.parentId])
    const collapsedNodes = []
    for (const node of topNodes) {
      clumpNodes(node)
    }
    return collapsedNodes

    function isBelowThreshold (node) {
      return (node.getWithinTime() + node.getBetweenTime()) * scale.scaleFactor < 10
    }

    function clumpNodes (node, clump = null) {
      if (isBelowThreshold(node)) {
        if (!clump) {
          clump = {
            isCollapsed: true,
            children: []
          }
        }
        // Node considered tiny, include it in a clump
        clump.children.push(node)
      } else {
        // Node considered long, include it as standalone
        collapsedNodes.push(node)
        clump = null
      }
      const indexBeforeBranching = collapsedNodes.length
      const childClumps = node.children.map(childId => {
        const child = subsetNodeById[childId]
        return child ? clumpNodes(child, clump) : null
      }).filter(hasFormedClump => !!hasFormedClump)
      // Combine sibling clumps
      for (let i = 1; i < childClumps.length; ++i) {
        if (childClumps[i] !== childClumps[0]) {
          childClumps[0].children = childClumps[0].children.concat(childClumps[i].children)
        }
        childClumps.splice(i, 1)
      }
      // Include combined clump
      if (childClumps[0] && collapsedNodes[indexBeforeBranching] !== childClumps[0]) {
        collapsedNodes.splice(indexBeforeBranching, 0, childClumps[0])
      }

      return clump
    }
  }
}

class LayoutNode {
  constructor (node, parent) {
    this.id = node.id
    this.node = node
    this.stem = null
    this.position = null
    this.inboundConnection = null
    this.parent = parent || null
    this.children = []
  }
}

class ArtificialNode extends ClusterNode {
  constructor (rawNode, nodeToCopy) {
    const nodeProperties = Object.assign({}, nodeToCopy, rawNode, {
      clusterId: rawNode.id || nodeToCopy.id,
      parentClusterId: rawNode.parentId || nodeToCopy.parentId,
      nodes: []
    })
    super(nodeProperties, nodeToCopy.dataSet)

    const defaultProperties = {
      replacesIds: [this.id],
      nodeType: 'AggregateNode'
    }
    const node = Object.assign(defaultProperties, rawNode)

    this.linkTo = nodeToCopy

    this.replacesIds = this.replacesIds
    this.nodeType = node.nodeType
  }
  getSameType (nodeId) {
    return this.dataSet.getByNodeType(this.nodeType, nodeId)
  }
}

module.exports = Layout
