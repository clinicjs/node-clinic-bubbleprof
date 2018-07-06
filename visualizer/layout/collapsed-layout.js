'use strict'

const _ = {
  difference: require('lodash/difference')
}

const { DataNode, ShortcutNode } = require('../data/data-node.js')
const { LayoutNode, CollapsedLayoutNode } = require('./layout-node.js')

class CollapsedLayout {
  constructor (layout) {
    this.uncollapsedLayout = layout
    // Shallow clone before modifying
    // TODO: revisit idempotency of this class - mutates each LayoutNode internally
    this.layoutNodes = new Map([...layout.layoutNodes])
    this.scale = layout.scale
    this.minimumNodes = 3

    // TODO: stop relying on coincidental Map.keys() order (i.e. stuff would break when child occurs before parent)
    // e.g. we could attach .topNodes or some iterator to Layout instances
    this.topLayoutNodes = new Set([...this.layoutNodes.values()].filter(layoutNode => !layoutNode.parent))

    const nodesBySize = [...this.layoutNodes.values()].sort((a, b) => a.getTotalTime() - b.getTotalTime())
    const nonShortcuts = nodesBySize.filter(ln => ln.node.constructor.name !== 'ShortcutNode')
    console.log('nonShortcuts.length', nonShortcuts.length)
    if (nonShortcuts.length < 8) {
      for (const layoutNode of nonShortcuts) {
        layoutNode.chosen = true
      }
      const newLayoutNodes = new Map()
      const topNodesIterator = this.topLayoutNodes.values()
      for (let i = 0; i < this.topLayoutNodes.size; ++i) {
        const topNode = topNodesIterator.next().value
        this.mergeShortcutNodes(topNode)
        this.indexLayoutNode(newLayoutNodes, topNode)
      }
      this.layoutNodes = newLayoutNodes
      return
    }
    const q75Index = Math.floor(nodesBySize.length * 0.85)
    const q75Nodes = nodesBySize.slice(q75Index, nodesBySize.length)
    console.log('q75Nodes.length', q75Nodes.length)
    const getDepth = (stemlessNode) => {
      const parentDepth = stemlessNode.parent ? getDepth(stemlessNode.parent) : 0
      return parentDepth + 1
    }
    const byDepth = (a, b) => getDepth(a) - getDepth(b)
    const remainingNodes = new Set(nodesBySize.slice(0, q75Index))// .sort(byDepth).reverse()
    const chosenLeaves = new Set()
    const x = new Map()
    for (const layoutNode of q75Nodes) {
      chosenLeaves.add(layoutNode.stem.longestLeaf || layoutNode)
      x.set(layoutNode.id, (layoutNode.stem.longestLeaf || layoutNode).id)
    }
    console.log('chosenLeaves.size', chosenLeaves.size)
    // const newLayoutNodes = new Map()
    for (const layoutNode of chosenLeaves) {
      for (const ancestorId of layoutNode.stem.ancestors.ids) {
        const ancestor = this.layoutNodes.get(ancestorId)
        ancestor.chosen = true
        remainingNodes.delete(ancestor)
        // newLayoutNodes.set(ancestor.id, ancestor)
      }
      remainingNodes.delete(layoutNode)
      layoutNode.chosen = true
      // newLayoutNodes.set(layoutNode.id, layoutNode)
    }
    // console.log({q75Nodes, chosenLeaves, remainingNodes})
    // console.log({uncollapsedLayout: this.uncollapsedLayout})

    // console.log({
    //   q75Nodes: q75Nodes.map(ln => ln.id),
    //   remainingNodes: [...remainingNodes].map(ln => ln.id),
    //   chosenLeaves: [...chosenLeaves].map(ln => ln.id),
    //   x
    // })

    // TODO: use lodash memoize?
    const findChosenAncestor = (layoutNode) => {
      if (!layoutNode.parent) {
        return
      }
      findChosenAncestor.cache = findChosenAncestor.cache || new Map()
      const fromCache = findChosenAncestor.cache.get(layoutNode.parent)
      if (fromCache) return fromCache
      if (layoutNode.parent.chosen) {
        findChosenAncestor.cache.set(layoutNode.parent, layoutNode.parent)
        return layoutNode.parent
      } else {
        const deeper = findChosenAncestor(layoutNode.parent)
        findChosenAncestor.cache.set(layoutNode.parent, deeper)
        return deeper
      }
    }

    const dropsByNode = new Map()
    const shortcutsByNode = new Map()
    for (const layoutNode of remainingNodes) {
      const chosenAncestor = findChosenAncestor(layoutNode)
      const arr = dropsByNode.get(chosenAncestor)
      if (!dropsByNode.get(chosenAncestor)) {
        dropsByNode.set(chosenAncestor, [])
      }
      if (!shortcutsByNode.get(chosenAncestor)) {
        shortcutsByNode.set(chosenAncestor, [])
      }
      if (layoutNode.node.constructor.name === 'ShortcutNode') {
        shortcutsByNode.get(chosenAncestor).push(layoutNode)
      } else {
        dropsByNode.get(chosenAncestor).push(layoutNode)
      }
    }

    const dropsByNodeByDepth = [...dropsByNode.keys()].sort(byDepth).map(layoutNode => ({ layoutNode, drops: dropsByNode.get(layoutNode), shortcuts: shortcutsByNode.get(layoutNode) }))
    for (const { layoutNode, drops, shortcuts } of dropsByNodeByDepth) {
      if (!drops.length) {
        continue
      }
      const ids = drops.map(ln => ln.id)
      const newChildren = _.difference(layoutNode.children, ids).concat(shortcuts.map(sh => sh.id))
      const isTopNode = this.topLayoutNodes.has(layoutNode)
      // console.log({isTopNode})
      const newCollapse = isTopNode ? drops : [layoutNode].concat(drops)
      const combined = new CollapsedLayoutNode(newCollapse, isTopNode ? layoutNode : layoutNode.parent, isTopNode ? [] : newChildren)
      combined.chosen = true
      this.layoutNodes.set(combined.id, combined)
      if (isTopNode) {
        layoutNode.children = newChildren.concat([combined.id])
      }
      if (layoutNode.parent) {
        const index = layoutNode.parent.children.indexOf(layoutNode.id)
        if (index !== -1) layoutNode.parent.children.splice(index, 1, combined.id)
      }
      for (const childId of newChildren) {
        this.layoutNodes.get(childId).parent = combined
      }
    }

    const newLayoutNodes = new Map()
    const topNodesIterator = this.topLayoutNodes.values()
    for (let i = 0; i < this.topLayoutNodes.size; ++i) {
      const topNode = topNodesIterator.next().value
      this.indexLayoutNode(newLayoutNodes, topNode)
    }

    // console.log({ dropsByNodeByDepth, newLayoutNodes })

    this.layoutNodes = newLayoutNodes
  }
  collapseX (layoutNode) {
    const children = layoutNode.children.map(childId => this.layoutNodes.get(childId))
    let combined
    for (let i = 0; i < children.length; ++i) {
      let child = children[i]
      const collapsedChild = this.collapseX(child)
      const squashNode = collapsedChild || child
      if (!squashNode.chosen) {
        const hostNode = combined || layoutNode
        // Do not vertically-collapse children which have at least one long grandchild
        // const longGrandChild = squashNode.children.map(childId => this.layoutNodes.get(childId)).find(child => !this.isCollapsible(child))
        // if (longGrandChild) {
        //   continue
        // }
        combined = this.combinelayoutNodes(hostNode, squashNode)
        if (combined) combined.chosen = layoutNode.chosen
      }
    }
    return combined
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
