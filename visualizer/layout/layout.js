'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ClusterNode } = require('../data/data-node.js')
const { validateNumber } = require('../validation.js')

class Layout {
  constructor ({ dataNodes, connection }, settings) {
    const defaultSettings = {
      svgWidth: 1000,
      svgHeight: 1000,
      svgDistanceFromEdge: 30,
      // lineWidth and labelMinimumSpace will usually be passed in from UI settings
      lineWidth: 2,
      labelMinimumSpace: 14
    }
    this.settings = Object.assign(defaultSettings, settings)

    this.scale = new Scale(this)
    this.positioning = new Positioning(this)

    this.connections = []
    this.connectionsByTargetId = new Map()

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

      if (parentLayoutNode) parentLayoutNode.children.push(dataNode.id)
      for (const childNodeId of dataNode.children) {
        createLayoutNode(childNodeId, layoutNode)
      }
    }
    const topDataNodes = dataNodes.filter(dataNode => !dataNode.parent)
    for (const dataNode of topDataNodes) {
      createLayoutNode(dataNode.id)
    }
  }

  // For layouts inside a clusterNode, rather than layouts of all cluterNodes
  prepareSublayoutNodes (dataNodes, connection) {
    // This sublayout is of nodes within targetNode. Some have parents within sourceNode

    const linkToSource = !connection.sourceNode ? null : new ArtificialNode({
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
          // Use the name, mark etc of the clusterNode the target node is inside
          }, childNode.clusterNode)

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

  processHierarchy ({ collapseNodes } = {}) {
    this.processBetweenData()
    this.scale.calculateScaleFactor()
    if (collapseNodes) {
      this.collapseNodes()
      this.processBetweenData()
      this.scale.calculateScaleFactor()
    }
  }

  // Like DataSet.processData(), call it seperately in main flow so that can be interupted in tests etc
  generate (settings) {
    this.processHierarchy(settings)
    this.positioning.formClumpPyramid()
    this.positioning.placeNodes()
  }

  collapseNodes () {
    const { layoutNodes, scale } = this
    const topLayoutNodes = [...this.layoutNodes.values()].filter(layoutNode => !layoutNode.parent)
    // TODO: stop relying on coincidental Map.keys() order
    const hierarchyOrder = []
    for (const layoutNode of topLayoutNodes) {
      squash(layoutNode)
    }
    const newLayoutNodes = new Map()
    for (const id of hierarchyOrder) {
      newLayoutNodes.set(id, layoutNodes.get(id))
    }
    this.layoutNodes = newLayoutNodes

    function squash (layoutNode, parent) {
      // Skip ArtificialNodes
      if (layoutNode instanceof ArtificialNode) return layoutNode

      // Squash children first
      const childrenAboveThreshold = []
      const collapsedChildren = []
      for (const childId of layoutNode.children) {
        const child = layoutNodes.get(childId)
        const squashed = squash(child, layoutNode)
        if (squashed) {
          collapsedChildren.push(squashed)
        } else {
          hierarchyOrder.unshift(childId)
          childrenAboveThreshold.push(child)
        }
      }

      const selfBelowThreshold = isBelowThreshold(layoutNode.node)
      const nodesBelowThreshold = selfBelowThreshold ? [layoutNode].concat(collapsedChildren) : collapsedChildren
      const flatLayoutNodes = flatMapDeep(nodesBelowThreshold.map(layoutNode => layoutNode.collapsedNodes || layoutNode))
      const grandChildren = flatMapDeep(collapsedChildren.map(collapsedLayoutNode => collapsedLayoutNode.children))
      const collapsedLayoutNode = new CollapsedLayoutNode(flatLayoutNodes, parent, childrenAboveThreshold.map(child => child.id).concat(grandChildren))
      const collapsedSize = collapsedLayoutNode && collapsedLayoutNode.collapsedNodes.length

      const isParentCollapsible = parent && isBelowThreshold(parent.node)
      if (!selfBelowThreshold) {
        if (collapsedSize >= 1) {
          // Merged children
          if (!layoutNodes.has(collapsedLayoutNode.id)) {
            indexCollapsedLayoutNode(collapsedLayoutNode)
            hierarchyOrder.unshift(collapsedLayoutNode.id)
          }
          layoutNode.children = [collapsedLayoutNode, ...childrenAboveThreshold].map(child => child.id)
        }
        if (!parent) {
          hierarchyOrder.unshift(layoutNode.id)
        }
      } else if (selfBelowThreshold && !isParentCollapsible && collapsedSize >= 2) {
        // Merged self and children
        indexCollapsedLayoutNode(collapsedLayoutNode)
        hierarchyOrder.unshift(collapsedLayoutNode.id)
      } else if (selfBelowThreshold && !parent) {
        // Short top-level node
        hierarchyOrder.unshift(layoutNode.id)
      }
      return selfBelowThreshold ? collapsedLayoutNode : null
    }

    function indexCollapsedLayoutNode (collapsedLayoutNode) {
      if (!collapsedLayoutNode.parent || !isBelowThreshold(collapsedLayoutNode.parent.node)) {
        layoutNodes.set(collapsedLayoutNode.id, collapsedLayoutNode)
      }
      for (const childId of collapsedLayoutNode.children) {
        layoutNodes.get(childId).parent = collapsedLayoutNode
        // Reindex child to position it after this clump
        // TODO: optimize this
        // const child = layoutNodes.get(childId)
        // layoutNodes.delete(childId)
        // layoutNodes.set(childId, child)
      }
      for (const layoutNode of collapsedLayoutNode.collapsedNodes) {
        layoutNode.parent = null
        layoutNode.children = []
        // layoutNodes.delete(layoutNode.id)
        // layoutNodes.delete('clump:' + layoutNode.id)
      }
    }

    function isBelowThreshold (dataNode) {
      return (dataNode.getWithinTime() + dataNode.getBetweenTime()) * scale.scaleFactor < 10
    }

    // Modified version of https://gist.github.com/samgiles/762ee337dff48623e729#gistcomment-2128332
    function flatMapDeep (value) {
      return Array.isArray(value) ? [].concat(...value.map(x => flatMapDeep(x))) : value
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
    this.parent = parent
    this.children = []
  }
  getBetweenTime () {
    return this.node.getBetweenTime()
  }
  getWithinTime () {
    return this.node.getWithinTime()
  }
  validateStat (...args) {
    return this.node.validateStat(...args)
  }
}

class CollapsedLayoutNode {
  constructor (layoutNodes, parent, children) {
    this.id = 'clump:' + layoutNodes.map(layoutNode => layoutNode.id).join(',')
    this.collapsedNodes = layoutNodes
    this.parent = parent
    this.children = children || []
  }
  getBetweenTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getBetweenTime(), 0)
  }
  getWithinTime () {
    return this.collapsedNodes.reduce((total, layoutNode) => total + layoutNode.node.getWithinTime(), 0)
  }
  validateStat (num, statType = '', aboveZero = false) {
    const targetDescription = `For ${this.constructor.name} ${this.id}${statType ? ` ${statType}` : ''}`
    return validateNumber(num, targetDescription, aboveZero)
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
