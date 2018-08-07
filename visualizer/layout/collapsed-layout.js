'use strict'

const _ = {
  difference: require('lodash/difference')
}

const { ShortcutNode } = require('../data/data-node.js')
const { LayoutNode, CollapsedLayoutNode } = require('./layout-node.js')

const { uniqueMapKey } = require('../validation.js')

class CollapsedLayout {
  constructor (layout) {
    this.uncollapsedLayout = layout
    // Shallow clone before modifying
    // TODO: revisit idempotency of this class - mutates each LayoutNode internally
    this.layoutNodes = new Map([...layout.layoutNodes])
    this.scale = layout.scale
    this.minimumNodes = 3

    this.collapseThreshold = 10 * this.scale.heightMultiplier

    // If debugging, expose one pool of ejected node IDs that is added to each time this class is initialized
    if (layout.settings.debugMode && !layout.ejectedLayoutNodeIds) layout.ejectedLayoutNodeIds = []

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
      this.mergeShortcutNodes(topNode)
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
  mergeShortcutNodes (layoutNode) {
    // Reduce shortcuts
    const { dataNodes, shortcutsByTarget } = this.groupNodesByTarget(layoutNode)
    const shortcutNodes = this.formShortcutBijection(shortcutsByTarget, layoutNode)
    // Update refs
    layoutNode.children = dataNodes.concat(shortcutNodes)
    // Traverse down
    for (let i = 0; i < layoutNode.children.length; ++i) {
      const childId = layoutNode.children[i]
      const childLayoutNode = this.layoutNodes.get(childId)
      this.mergeShortcutNodes(childLayoutNode)
    }
  }
  groupNodesByTarget (layoutNode) {
    // Used to group alike ShortcutNodes together
    // Maps { LayoutNode => [...ShortcutNode] }
    // e.g. { LayoutNode-2 => [ShortcutNode-2], CollapsedLayoutNode-clump:3,4,5 => [ShortcutNode-3, ShortcutNode-4, ShortcutNode-5] }
    const shortcutsByTarget = new Map()

    const dataNodes = []
    for (let i = 0; i < layoutNode.children.length; ++i) {
      const childId = layoutNode.children[i]
      const childLayoutNode = this.layoutNodes.get(childId)
      if (childLayoutNode.node.constructor.name === 'ShortcutNode') {
        const shortcutNode = childLayoutNode.node
        const targetLayoutNode = this.uncollapsedLayout.findDataNode(shortcutNode.shortcutTo, true)
        let targetShortcuts = shortcutsByTarget.get(targetLayoutNode)
        if (!targetShortcuts) {
          targetShortcuts = []
          shortcutsByTarget.set(targetLayoutNode, targetShortcuts)
        }
        targetShortcuts.push(childLayoutNode)
      } else {
        dataNodes.push(childId)
      }
    }
    return { dataNodes, shortcutsByTarget }
  }
  formShortcutBijection (shortcutsByTarget, parentLayoutNode) {
    const bijectiveShortcuts = []
    const shortcutsIterator = shortcutsByTarget.entries()
    for (let i = 0; i < shortcutsByTarget.size; ++i) {
      const [targetLayoutNode, shortcutNodes] = shortcutsIterator.next().value
      if (shortcutNodes.length === 1) {
        bijectiveShortcuts.push(shortcutNodes[0].id)
        continue
      }

      const mergedShortcut = new ShortcutNode({
        id: `shortcut:${targetLayoutNode.id}`,
        children: [],
        parentId: parentLayoutNode.id
      }, targetLayoutNode.node)
      mergedShortcut.targetLayoutNode = targetLayoutNode
      const mergedLayoutNode = new LayoutNode(mergedShortcut, parentLayoutNode)
      for (let i = 0; i < shortcutNodes.length; ++i) {
        const shortcutLayoutNode = shortcutNodes[i]
        this.layoutNodes.delete(shortcutLayoutNode.id)
      }
      this.layoutNodes.set(mergedLayoutNode.id, mergedLayoutNode)
      bijectiveShortcuts.push(mergedLayoutNode.id)
    }
    return bijectiveShortcuts
  }
  collapseHorizontally (layoutNode) {
    let combined
    let prevTiny
    const children = layoutNode.children.map(childId => this.layoutNodes.get(childId))
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      const belowThreshold = this.isBelowThreshold(child)
      this.collapseHorizontally(child)
      if (this.countNonShortcutNodes() <= this.minimumNodes) {
        break
      }
      if (belowThreshold) {
        if (combined || prevTiny) {
          combined = this.combineLayoutNodes(combined || prevTiny, child)
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
      const hostNode = combined || layoutNode
      const collapsedChild = this.collapseVertically(child)

      if (this.topLayoutNodes.has(layoutNode)) continue

      const squashNode = collapsedChild || child
      const isCollapsible = this.isVerticallyCollapsible(child, hostNode, squashNode)
      if (isCollapsible) {
        if (isCollapsible === 'abort') break

        // combineLayoutNodes() can cancel itself and return nothing; if so, keep previous value of combined
        combined = this.combineLayoutNodes(hostNode, squashNode) || combined
      }
    }
    return combined
  }
  combineLayoutNodes (hostNode, squashNode) {
    if ([hostNode.node.constructor.name, squashNode.node.constructor.name].includes('ShortcutNode')) {
      return
    }
    if (!this.isCollapsible(hostNode) || !this.isCollapsible(squashNode)) {
      return
    }

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

    const collapsedNodes = hostNodes.concat(squashNodes).sort(this.uncollapsedLayout.getLayoutNodeSorter())

    const collapsedId = uniqueMapKey('x', this.layoutNodes, '', 1)
    const collapsed = new CollapsedLayoutNode(collapsedId, collapsedNodes, parent, children)

    // Update refs
    ejectLayoutNode(parent, hostNode)
    if (this.uncollapsedLayout.settings.debugMode) this.uncollapsedLayout.ejectedLayoutNodeIds.push(hostNode.id)

    ejectLayoutNode(parent, squashNode)
    if (this.uncollapsedLayout.settings.debugMode) this.uncollapsedLayout.ejectedLayoutNodeIds.push(squashNode.id)

    insertLayoutNode(this.layoutNodes, parent, collapsed)

    // Update indices
    this.layoutNodes.set(collapsed.id, collapsed)
    this.layoutNodes.delete(hostNode.id)
    this.layoutNodes.delete(squashNode.id)

    return collapsed
  }
  countNonShortcutNodes () {
    let shortcutCount = 0
    this.layoutNodes.forEach(layoutNode => {
      if (layoutNode.node.constructor.name === 'ShortcutNode') shortcutCount++
    })
    return this.layoutNodes.size - shortcutCount
  }
  isBelowThreshold (layoutNode) {
    return layoutNode.getTotalTime() * this.scale.sizeIndependentScale < this.collapseThreshold
  }
  isCollapsible (layoutNode) {
    return layoutNode.collapsedNodes || this.isBelowThreshold(layoutNode)
  }
  isVerticallyCollapsible (child, hostNode, squashNode) {
    if (this.countNonShortcutNodes() <= this.minimumNodes) {
      return 'abort' // Can't squash beyond this point so we can tell calling function to stop
    }

    const belowThreshold = child.collapsedNodes || this.isBelowThreshold(child)
    if (!belowThreshold) return false

    // Do not vertically-collapse children which have at least one long grandchild
    const longGrandChild = squashNode.children.map(childId => this.layoutNodes.get(childId)).find(child => !this.isCollapsible(child))
    if (longGrandChild) return false

    return true
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
