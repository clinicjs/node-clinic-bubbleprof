'use strict'

const _ = {
  difference: require('lodash/difference')
}

const { ShortcutNode } = require('../data/data-node.js')
const { LayoutNode, CollapsedLayoutNode } = require('./layout-node.js')
const { pickLeavesByLongest } = require('./stems.js')
const { uniqueMapKey, removeFromCounter } = require('../validation.js')

class CollapsedLayout {
  constructor (layout) {
    this.uncollapsedLayout = layout
    // Shallow clone before modifying
    // TODO: revisit idempotency of this class - mutates each LayoutNode internally
    this.layoutNodes = new Map([...layout.layoutNodes])

    this.scale = layout.scale
    this.minimumNodes = 3

    // If debugging, expose one pool of ejected node IDs that is added to each time this class is initialized
    if (layout.settings.debugMode && !layout.ejectedLayoutNodeIds) layout.ejectedLayoutNodeIds = []

    const layoutNodesArray = [...this.layoutNodes.values()]
    const layoutNodesCount = layoutNodesArray.length
    this.shortcutCount = 0
    this.topLayoutNodes = new Set()
    for (let i = 0; i < layoutNodesCount; ++i) {
      const layoutNode = layoutNodesArray[i]
      if (layoutNode.node.constructor.name === 'ShortcutNode') this.shortcutCount++
      if (!layoutNode.parent) this.topLayoutNodes.add(layoutNode)
    }

    this.setCollapseThreshold(layout.settings, this.scale.heightMultiplier)

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

  setCollapseThreshold (settings, multiplier = 1) {
    // Set an initial value based on settings then test it
    this.collapseThreshold = settings.initialCollapseThreshold * multiplier

    const leaves = pickLeavesByLongest(this.layoutNodes)
    const leavesCount = leaves.length
    for (let i = 0; i < leavesCount; i++) {
      this.testStemLength(leaves[i], settings, multiplier)
    }
  }

  testStemLength (layoutNode, settings, multiplier) {
    let isCollapsible
    const availableHeight = settings.sizeIndependentHeight

    // Begin loop if this stem's absolute total doesn't fit in the available space
    let absoluteExceedsHeight = layoutNode.stem.lengths.absolute > availableHeight
    while (absoluteExceedsHeight) {
      // Loop increases collapse threshold until this stem fits
      const ancestorIds = layoutNode.stem.ancestors.ids
      let stemLengthAfterCollapse = 0

      // This should be impossible - but in case some bug is introduced, a warning and break is better than an infinite loop
      /* istanbul ignore next */
      if (this.collapseThreshold / multiplier > availableHeight) {
        const details = `LayoutNode ${layoutNode.id}'s ${ancestorIds.length}-length stem won't collapse to fit ${availableHeight}px.`
        console.warn(`Infinite loop prevented. ${details}`)
        break
      }

      // Iterate backwards through ancestors i.e. from furthest ancestor first
      for (let i = layoutNode.stem.ancestors.ids.length - 1; i >= 0; i--) {
        const ancestorNode = this.layoutNodes.get(layoutNode.stem.ancestors.ids[i])

        const childNode = this.layoutNodes.get(layoutNode.stem.ancestors.ids[i + 1])
        const isMidpoint = childNode && !this.topLayoutNodes.has(ancestorNode)
        if (!isMidpoint) continue

        isCollapsible = this.isVerticallyCollapsible(childNode, ancestorNode)
        if (isCollapsible === 'abort') break
        if (!isCollapsible) {
          stemLengthAfterCollapse += 1
        }
      }
      if (isCollapsible === 'abort') break // Exit while loop too if it's not possible to collapse any further

      const stemAbsoluteAfterCollapse = layoutNode.stem.getAbsoluteLength(stemLengthAfterCollapse)

      // If this stem's absolute total still doesn't fit, increase the collapse threshold and loop until it does; else exit loop
      absoluteExceedsHeight = stemAbsoluteAfterCollapse > settings.sizeIndependentHeight
      if (absoluteExceedsHeight) this.collapseThreshold = this.collapseThreshold * 1.05
    }
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

  removeLayoutNode (id) {
    this.layoutNodes.delete(id)
    if (id.charAt(0) === 'x') removeFromCounter(id, 'x', this.layoutNodes, '')
  }

  countNonShortcutNodes () {
    const total = this.layoutNodes.size
    const nonShortcutCount = total - this.shortcutCount
    if (nonShortcutCount <= 0) throw new Error(`${nonShortcutCount} non-shortcut nodes (${total} nodes, ${this.shortcutCount} shortcuts)`)
    return nonShortcutCount
  }

  isBelowThreshold (layoutNode) {
    return layoutNode.getTotalTime() * this.scale.sizeIndependentScale < this.collapseThreshold
  }

  isCollapsible (layoutNode) {
    return layoutNode.collapsedNodes || this.isBelowThreshold(layoutNode)
  }

  isVerticallyCollapsible (childNode, hostNode, squashNode = childNode) {
    if (this.countNonShortcutNodes() <= this.minimumNodes) {
      return 'abort' // Can't squash beyond this point so we can tell calling function to stop
    }

    const belowThreshold = childNode.collapsedNodes || this.isBelowThreshold(childNode)
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
