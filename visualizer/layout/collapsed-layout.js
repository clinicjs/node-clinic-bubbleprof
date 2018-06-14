'use strict'

const _ = {
  difference: require('lodash/difference'),
  intersection: require('lodash/intersection')
}

const { CollapsedLayoutNode } = require('./layout-node.js')

class CollapsedLayout {
  constructor (layoutNodes, scale) {
    // Shallow clone before modifying
    this.layoutNodes = new Map([...layoutNodes.entries()])
    this.scale = scale
    this.minimumNodes = 3

    // TODO: stop relying on coincidental Map.keys() order (i.e. stuff would break when child occurs before parent)
    // e.g. we could attach .topNodes or some iterator to Layout instances
    this.topLayoutNodes = new Set([...this.layoutNodes.values()].filter(layoutNode => !layoutNode.parent))

    let topNodesIterator = this.topLayoutNodes.values()
    for (let i = 0; i < this.topLayoutNodes.size; ++i) {
      const topNode = topNodesIterator.next().value
      this.collapseHorizontally(topNode)
    }
    const newLayoutNodes = new Map()
    // Isolating vertical collapsing from horizontal collapsing
    // Mainly for aesthetic reasons, but also reduces complexity (easier to debug)
    topNodesIterator = this.topLayoutNodes.values()
    for (let i = 0; i < this.topLayoutNodes.size; ++i) {
      const topNode = topNodesIterator.next().value
      this.collapseVertically(topNode)
      this.indexLayoutNode(newLayoutNodes, topNode)
    }
    this.layoutNodes = newLayoutNodes
  }
  indexLayoutNode (nodesMap, layoutNode) {
    nodesMap.set(layoutNode.id, layoutNode)
    for (let i = 0; i < layoutNode.children.length; ++i) {
      const childId = layoutNode.children[i]
      this.indexLayoutNode(nodesMap, this.layoutNodes.get(childId))
    }
  }
  collapseHorizontally (layoutNode) {
    let combined
    let prevTiny
    const children = layoutNode.children.map(childId => this.layoutNodes.get(childId))
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      const belowThreshold = this.isBelowThreshold(child)
      this.collapseHorizontally(child)
      if (this.layoutNodes.size === this.minimumNodes) {
        break
      }
      if (belowThreshold) {
        if (combined || prevTiny) {
          combined = this.combinelayoutNodes(combined || prevTiny, child)
        }
        prevTiny = child
      }
    }
  }
  collapseVertically (layoutNode) {
    const children = layoutNode.children.map(childId => this.layoutNodes.get(childId))
    let combined
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      const belowThreshold = child.collapsedNodes || this.isBelowThreshold(child)
      const collapsedChild = this.collapseVertically(child)
      if (this.layoutNodes.size === this.minimumNodes) {
        break
      }
      if (belowThreshold && !this.topLayoutNodes.has(layoutNode)) {
        const hostNode = combined || layoutNode
        const squashNode = collapsedChild || child
        // Do not vertically-collapse children which have at least one long grandchild
        const longGrandChild = squashNode.children.map(childId => this.layoutNodes.get(childId)).find(child => !this.isCollapsible(child))
        if (longGrandChild) {
          continue
        }
        combined = this.combinelayoutNodes(hostNode, squashNode)
      }
    }
    return combined
  }
  combinelayoutNodes (hostNode, squashNode) {
    // TODO: support uncollapsible shortcut nodes
    // i.e. currently some views get really messy when we render them all
    // we need to come up with some ux improvements on how to display them without making much noise
    //
    // const nodeTypes = [hostNode.node.constructor.name, squashNode.node.constructor.name]
    // const forbiddenTypes = ['ShortcutNode']
    // if (_.intersection(nodeTypes, forbiddenTypes).length) {
    //   return
    // }

    if (!hostNode || !squashNode) {
      return
    }
    if (!this.isCollapsible(hostNode) || !this.isCollapsible(squashNode)) {
      return
    }

    // TODO: also check this.minimumNodes here?

    // hostNode is expected to be either direct parent or direct sibling of squashNode
    const parent = hostNode.parent
    if (hostNode.parent !== squashNode.parent && squashNode.parent !== hostNode) {
      const toContext = layoutNode => ((layoutNode.parent && toContext(layoutNode.parent) + '=>') || '') + layoutNode.id
      const context = toContext(hostNode) + ' + ' + toContext(squashNode)
      throw new Error('Cannot combine nodes - clump/stem mismatch: ' + context)
    }
    const children = _.difference(hostNode.children.concat(squashNode.children), [squashNode.id])

    const hostNodes = hostNode.collapsedNodes ? [...hostNode.collapsedNodes] : [hostNode]
    const squashNodes = squashNode.collapsedNodes ? [...squashNode.collapsedNodes] : [squashNode]
    const collapsed = new CollapsedLayoutNode(hostNodes.concat(squashNodes), parent, children)

    // Update refs
    ejectLayoutNode(parent, hostNode)
    ejectLayoutNode(parent, squashNode)
    insertLayoutNode(this.layoutNodes, parent, collapsed)
    // Update indices
    this.layoutNodes.set(collapsed.id, collapsed)
    this.layoutNodes.delete(hostNode.id)
    this.layoutNodes.delete(squashNode.id)

    return collapsed
  }
  isBelowThreshold (layoutNode) {
    return layoutNode.getTotalTime() * this.scale.sizeIndependentScale < 10
  }
  isCollapsible (layoutNode) {
    return layoutNode.collapsedNodes || this.isBelowThreshold(layoutNode)
  }
}

function ejectLayoutNode (parent, layoutNode) {
  layoutNode.parent = null
  layoutNode.children = []
  // TODO: optimize .children and .collapsedNodes using Set?
  // (faster at lookup and removal, but slower at addition and iteration - https://stackoverflow.com/a/39010462)
  const index = parent.children.indexOf(layoutNode.id)
  if (index !== -1) parent.children.splice(index, 1)
}

function insertLayoutNode (layoutNodes, parent, layoutNode) {
  parent.children.unshift(layoutNode.id)
  for (let i = 0; i < layoutNode.children.length; ++i) {
    const child = layoutNodes.get(layoutNode.children[i])
    child.parent = layoutNode
  }
}

module.exports = CollapsedLayout
