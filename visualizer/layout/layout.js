'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ClusterNode } = require('../data/data-node.js')

class Layout {
  constructor (nodes, settings, collapseNodes = false) {
    const defaultSettings = {
      svgWidth: 1000,
      svgHeight: 1000,
      svgDistanceFromEdge: 30,
      lineWidth: 2.5,
      labelMinimumSpace: 14
    }
    this.settings = Object.assign(defaultSettings, settings)

    // TODO: phase out this.nodes, use layoutNodes exclusively
    this.nodes = nodes
    this.nodesMap = new Map(nodes.map(node => [node.id, node]))

    // TODO: re-evaluate this, does it still make sense to initialise these now?
    this.scale = new Scale(this)
    this.positioning = new Positioning(this)

    this.connections = []
    this.connectionsByTargetId = new Map()

    this.layoutNodes = new Map()
    this.stems = new Map()
  }

  prepareLayoutNodes () {
    const createLayoutNode = (nodeId, parentLayoutNode) => {
      const node = this.nodesMap.get(nodeId)
      // if nodeId is a member of a clump, node.id is the id of the clump itself
      if (this.layoutNodes.has(node.id)) return

      const layoutNode = new LayoutNode(node, parentLayoutNode)
      this.layoutNodes.set(node.id, layoutNode)

      if (parentLayoutNode) parentLayoutNode.children.push(node.id)
      for (const childNodeId of node.children) {
        createLayoutNode(childNodeId, layoutNode)
      }
    }
    createLayoutNode(this.nodes[0].id)
  }

  // For layouts inside a clusterNode, rather than layouts of all cluterNodes
  prepareSublayoutNodes (connection) {
    // This sublayout is of nodes within targetNode. Some have parents within sourceNode
    const linkToSource = new ArtificialNode({
      id: connection ? connection.sourceNode.id : 0,
      isRoot: true,
      children: []
    }, connection ? connection.sourceNode : this.nodes[0])

    this.nodesMap.set(linkToSource.id, linkToSource)
    this.nodes.unshift(linkToSource)

    // let nodeType // TODO: see if this is necessary when clusters-of-clusters are implemented
    for (const node of this.nodes) {
      // if (!nodeType) nodeType = node.constructor.name

      if (node.isBetweenClusters) {
        linkToSource.children.push(node.id)
      }
      for (const childId of node.children) {
        // If this child is in another cluster, add a dummy leaf node -> clickable link to that cluster
        if (!this.nodes.some(node => node.id === childId)) {
          const childNode = node.getSameType(childId)

          // If we're inside a cluster of clusters, childNode might be on the top level of clusters
          const linkOnwards = new ArtificialNode({
            id: childId,
            children: [],
            parentId: node.id
          }, childNode.clusterNode)

          this.nodesMap.set(linkOnwards.id, linkOnwards)
          this.nodes.push(linkOnwards)
        }
      }
    }
    this.prepareLayoutNodes()
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
