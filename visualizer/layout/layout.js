'use strict'

const Stem = require('./stems.js')
const Connection = require('./connections.js')
const Scale = require('./scale.js')
const Positioning = require('./positioning.js')
const { ClusterNode } = require('../data/data-node.js')
const arrayFlatten = require('array-flatten')
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

    const includedIds = new Set(dataNodes.map(dataNode => dataNode.id))

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

      if (linkToSource && !includedIds.has(dataNode.parentId)) {
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
          }, childNode.clusterId ? childNode : childNode.clusterNode)

          dataNodes.push(linkOnwards)
        }
      }
    }
    this.prepareLayoutNodes(dataNodes)
  }

  processBetweenData (generateConnections = true) {
    for (const layoutNode of this.layoutNodes.values()) {
      layoutNode.stem = new Stem(this, layoutNode)

      if (generateConnections && layoutNode.parent) {
        const connection = new Connection(layoutNode.parent, layoutNode, this.scale)
        this.connectionsByTargetId.set(layoutNode.id, connection)
        this.connections.push(connection)
        layoutNode.inboundConnection = connection
      }
    }
  }

  processHierarchy ({ collapseNodes = false } = {}) {
    this.processBetweenData(!collapseNodes)
    this.scale.calculateScaleFactor()
    if (collapseNodes) {
      this.collapseNodes()
      this.processBetweenData(true)
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

    // TODO: optimize
    function squash (layoutNode, parent) {
      // Skip ArtificialNodes
      if (layoutNode instanceof ArtificialNode) return layoutNode

      // Squash children first
      const childrenAboveThreshold = []
      const childrenBelowThreshold = []
      const collapsedChildren = []
      for (const childId of layoutNode.children) {
        const child = layoutNodes.get(childId)
        const squashed = squash(child, layoutNode)
        if (isBelowThreshold(child.node)) {
          squashed ? collapsedChildren.push(squashed) : childrenBelowThreshold.push(child)
        } else {
          childrenAboveThreshold.push(child)
        }
      }

      // For detecting children-grandchildren collision
      const childToCollapse = new Map()
      for (const collapsedChild of collapsedChildren) {
        for (const layoutNode of collapsedChild.collapsedNodes) {
          childToCollapse.set(layoutNode.id, collapsedChild)
        }
      }
      const collapsibleChildren = childrenBelowThreshold.concat(arrayFlatten(collapsedChildren.map(collapsedLayoutNode => collapsedLayoutNode.collapsedNodes)))
      const grandChildren = arrayFlatten(collapsibleChildren.map(collapsedLayoutNode => collapsedLayoutNode.children)).filter(childId => !childToCollapse.get(childId))
      let combinedSelfCollapse
      let combinedChildrenCollapse
      const selfBelowThreshold = isBelowThreshold(layoutNode.node)
      const selfTopNode = topLayoutNodes.includes(layoutNode)
      if (selfBelowThreshold && collapsibleChildren.length && !selfTopNode) {
        // Combine children and self
        combinedSelfCollapse = new CollapsedLayoutNode([layoutNode].concat(collapsibleChildren), parent, grandChildren.concat(childrenAboveThreshold.map(child => child.id)))
      } else if (collapsibleChildren.length >= 2) {
        // Combine children only
        combinedChildrenCollapse = new CollapsedLayoutNode(collapsibleChildren, layoutNode, grandChildren)
        layoutNode.children = [combinedChildrenCollapse, ...childrenAboveThreshold].map(child => child.id)
      }

      let nodesToIndex
      if (selfBelowThreshold && !selfTopNode) {
        // If self collapsible, index only childrenAboveThreshold
        nodesToIndex = childrenAboveThreshold
      } else {
        // If self not collapsible, index all children
        nodesToIndex = childrenAboveThreshold.concat(combinedChildrenCollapse || childrenBelowThreshold.concat(collapsedChildren))
      }
      // If no parent index self
      if (!parent) {
        nodesToIndex.push(combinedSelfCollapse || layoutNode)
      }
      for (const layoutNode of nodesToIndex) {
        if (layoutNode instanceof CollapsedLayoutNode) {
          indexLayoutNode(layoutNode)
        }
        hierarchyOrder.unshift(layoutNode.id)
      }

      return combinedSelfCollapse || null
    }
    function indexLayoutNode (collapsedLayoutNode) {
      layoutNodes.set(collapsedLayoutNode.id, collapsedLayoutNode)
      for (const childId of collapsedLayoutNode.children) {
        layoutNodes.get(childId).parent = collapsedLayoutNode
      }
      for (const layoutNode of collapsedLayoutNode.collapsedNodes) {
        layoutNode.parent = null
        layoutNode.children = []
      }
    }

    function isBelowThreshold (dataNode) {
      return (dataNode.getWithinTime() + dataNode.getBetweenTime()) * scale.scaleFactor < 10
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

    for (const layoutNode of layoutNodes) {
      const node = layoutNode.node
      if (!this.node) {
        this.node = new ArtificialNode({
          nodeType: node.constructor.name
        }, node)
      } else {
        this.node.aggregateStats(node)
        this.applyDecimals(node)
      }
    }
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
  applyDecimals (otherNode) {
    this.node.aggregateDecimals(otherNode, 'type', 'between')
    this.node.aggregateDecimals(otherNode, 'type', 'within')
    this.node.aggregateDecimals(otherNode, 'typeCategory', 'between')
    this.node.aggregateDecimals(otherNode, 'typeCategory', 'within')
    // TODO: aggregate party, draw appropriate pie
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
  aggregateStats (dataNode) {
    this.stats.setSync(this.stats.sync + dataNode.stats.sync)
    this.stats.async.setWithin(this.stats.async.within + dataNode.stats.async.within)
    this.stats.async.setBetween(this.stats.async.between + dataNode.stats.async.between)

    this.stats.rawTotals.sync += dataNode.stats.rawTotals.sync
    this.stats.rawTotals.async.between += dataNode.stats.rawTotals.async.between
    this.stats.rawTotals.async.within += dataNode.stats.rawTotals.async.within
  }
  aggregateDecimals (dataNode, classification, position) {
    if (dataNode.constructor.name === 'AggregateNode') {
      /* TODO: fix this
      const label = otherNode[classification]
      const newDecimal = otherNode.decimals[classification][position].get(label)
      this.setDecimal(newDecimal, classification, position, label)
      */
    } else {
      const byLabel = dataNode.decimals[classification][position]
      for (const [label, value] of byLabel) {
        this.setDecimal(value, classification, position, label)
      }
    }
  }
}

module.exports = Layout
