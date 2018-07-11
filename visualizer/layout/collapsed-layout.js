'use strict'

const _ = {
  difference: require('lodash/difference')
}

const { ShortcutNode } = require('../data/data-node.js')
const { LayoutNode, CollapsedLayoutNode } = require('./layout-node.js')
const { pickLeavesByLongest } = require('./stems.js')

class CollapsedLayout {
  constructor (layout) {
    this.uncollapsedLayout = layout
    // const insideCollapse = this.uncollapsedLayout.originNode && this.uncollapsedLayout.originNode.collapsedNodes
    const nonShortcuts = [...layout.layoutNodes.values()].filter(layoutNode => layoutNode.node.constructor.name !== 'ShortcutNode')
    // let deepest = layout.rootLayoutNode && layout.rootLayoutNode.stem.deepestLeaf
    // deepest = deepest && deepest.stem.ancestors.ids.length
    const getDeepest = () => {
      if (getDeepest.deepest) {
        return getDeepest.deepest
      }
      let deepest = layout.rootLayoutNode && layout.rootLayoutNode.stem.deepestLeaf
      deepest = deepest && deepest.stem.ancestors.ids.length
      getDeepest.deepest = deepest
      return deepest
    }
    // const isHomogenousHorizontally = () => {
    //   const allNamedSame = () => nonShortcuts.length < 2 || !nonShortcuts.some(layoutNode => layoutNode.node.name !== nonShortcuts[0].node.name)
    //   const fromOriginNode = this.uncollapsedLayout.originNode && this.uncollapsedLayout.originNode.isHomogenousHorizontally
    //   return fromOriginNode || (getDeepest() === 1 && allNamedSame())
    // }
    const isHomogenousHorizontally = () => {
      const topLayoutNodes = [...layout.layoutNodes.values()].filter(layoutNode => !layoutNode.parent) // warning: not a Set like class member field
      const firstChildren = topLayoutNodes.reduce((prev, next) => ({ children: prev.children.concat(next.children) }), { children: [] }).children.map(id => layout.layoutNodes.get(id))
      const allNamedSame = () => firstChildren.length >= 2 && !firstChildren.some(layoutNode => layoutNode.node.name !== firstChildren[0].node.name)
      const fromOriginNode = this.uncollapsedLayout.originNode && this.uncollapsedLayout.originNode.isHomogenousHorizontally
      return (fromOriginNode || allNamedSame()) ? firstChildren[0].node.name : false
    }
    this.isHomogenous = {
      horizontally: isHomogenousHorizontally()
    }
    const optimalSize = 5
    if (nonShortcuts.length <= optimalSize) { // Prevent creating excess collapses
      this.layoutNodes = layout.layoutNodes
      return
    }
    // Shallow clone before modifying
    // TODO: revisit idempotency of this class - mutates each LayoutNode internally
    this.layoutNodes = new Map([...layout.layoutNodes])
    this.scale = layout.scale

    // TODO: stop relying on coincidental Map.keys() order (i.e. stuff would break when child occurs before parent)
    // e.g. we could attach .topNodes or some iterator to Layout instances
    this.topLayoutNodes = new Set([...this.layoutNodes.values()].filter(layoutNode => !layoutNode.parent))

    let topNodesIterator = this.topLayoutNodes.values()
    for (let i = 0; i < this.topLayoutNodes.size; ++i) {
      const topNode = topNodesIterator.next().value
      // this.collapseHorizontally(topNode)
      this.collapseX(topNode)
    }
    const newLayoutNodes = new Map()
    // Isolating vertical collapsing from horizontal collapsing
    // Mainly for aesthetic reasons, but also reduces complexity (easier to debug)
    topNodesIterator = this.topLayoutNodes.values()
    for (let i = 0; i < this.topLayoutNodes.size; ++i) {
      const topNode = topNodesIterator.next().value
      // this.collapseVertically(topNode)
      this.mergeShortcutNodes(topNode)
      this.indexLayoutNode(newLayoutNodes, topNode)
    }
    this.layoutNodes = newLayoutNodes
  }
  collapseX (layoutNode) {
    let children = layoutNode.children.map(childId => this.layoutNodes.get(childId)).filter(ln => ln.node.constructor.name !== 'ShortcutNode')
    if (!children.length) {
      return
    }
    const nameMap = {}
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      const name = child.name || child.node.name
      nameMap[name] = nameMap[name] || new Set()
      nameMap[name].add(child)
    }
    let entries = Object.entries(nameMap)
    entries.forEach(entry => entry[1] = Array.from(entry[1]))
    if (children[0].node.name === this.isHomogenous.horizontally) { // do not accidentally spread descendants
      const name = entries[0][0]
      const layoutNodesInClump = entries[0][1]
      let optimalSize = 5
      let optimalStems = 5
      if (layoutNodesInClump.length / optimalSize > optimalStems) { // when more nodes per stem than optimalSize, change size to fit into optimalStems
        optimalSize = layoutNodesInClump.length / optimalStems
        console.log('TOO MANY', { optimalSize, optimalStems })
      } else if (layoutNodesInClump.length / optimalStems <  2) { // when not enough nodes to make optimalStems, make stem for every pair
        optimalStems = Math.ceil(layoutNodesInClump.length / 2)
        optimalSize = 2
        console.log('TOO LITTLE', { optimalSize, optimalStems })
      } else {
        optimalSize = layoutNodesInClump.length / optimalStems
        console.log('SIZE IS RIGHT', { optimalSize, optimalStems })
      }
      entries = []
      for (let i = 0; i < optimalStems; ++i) {
        const chunk = [name, layoutNodesInClump.splice(0, optimalSize)]
        if (chunk[1].length) entries.push(chunk)
      }
    } // Prevent creating mono-views where only actionable is clicking to expand
    for (let i = 0; i < entries.length; ++i) {
      let layoutNodes = entries[i][1]
      if (layoutNodes.length < 2) {
        continue
      }
      let combined = layoutNodes[0]
      for (let j = 1; j < layoutNodes.length; ++j) {
        const child = layoutNodes[j]
        combined = this.combinelayoutNodes(combined, child) || combined
          // combined.allSame = true
        combined.isHomogenousHorizontally = true
      }
    }
    children = layoutNode.children.map(childId => this.layoutNodes.get(childId))
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      this.collapseX(child)
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
        const finder = !isNaN(shortcutNode.shortcutTo.aggregateId) ? 'findAggregateNode' : 'findDataNode'
        const targetLayoutNode = this.uncollapsedLayout[finder](shortcutNode.shortcutTo, true)
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

      let counter = 1
      while (this.layoutNodes.get(`shortcut-${counter}:${targetLayoutNode.id}`)) {
        counter++
      }
      const mergedShortcut = new ShortcutNode({
        id: `shortcut-${counter}:${targetLayoutNode.id}`,
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
    if ([hostNode.node.constructor.name, squashNode.node.constructor.name].includes('ShortcutNode')) {
      return
    }
    // if (!this.isCollapsible(hostNode) || !this.isCollapsible(squashNode)) {
    //   return
    // }

    // hostNode is expected to be either direct parent or direct sibling of squashNode
    const parent = hostNode.parent
    if (hostNode.parent !== squashNode.parent && squashNode.parent !== hostNode) {
      const toContext = layoutNode => ((layoutNode.parent && toContext(layoutNode.parent) + '=>') || '') + layoutNode.id
      const context = toContext(hostNode) + ' + ' + toContext(squashNode)
      throw new Error('Cannot combine nodes - clump/stem mismatch: ' + context)
    }
    const children = _.difference(hostNode.children.concat(squashNode.children), [squashNode.id])

    const format = n => n.id + '[' + n.children.join(';') + ']'

    const hostNodes = hostNode.collapsedNodes ? [...hostNode.collapsedNodes] : [hostNode]
    const squashNodes = squashNode.collapsedNodes ? [...squashNode.collapsedNodes] : [squashNode]

    const collapsedNodes = hostNodes.concat(squashNodes).sort(this.uncollapsedLayout.getLayoutNodeSorter())
    const collapsed = new CollapsedLayoutNode(collapsedNodes, parent, children)

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
