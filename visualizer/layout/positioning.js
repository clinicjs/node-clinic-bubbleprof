'use strict'

const { pickLeavesByLongest } = require('./stems.js')
const NodeAllocation = require('./node-allocation.js')
const arrayFlatten = require('array-flatten').flatten

// Modified version of https://gist.github.com/samgiles/762ee337dff48623e729#gistcomment-2128332

class Positioning {
  constructor (layout) {
    this.layout = layout
    this.layoutNodes = null // defined later
  }

  formClumpPyramid () {
    this.layoutNodes = this.layout.layoutNodes
    const leavesByLongest = pickLeavesByLongest(this.layoutNodes)
    const clumpPyramid = new ClumpPyramid(this.layout)
    clumpPyramid.setLeaves(leavesByLongest)
    this.order = clumpPyramid.order
  }

  placeNodes () {
    const nodeAllocation = new NodeAllocation(this.layout, this.layoutNodes)
    nodeAllocation.process()
    if (this.layout.settings.debugMode) this.nodeAllocation = nodeAllocation
  }

  debugInspect () {
    const intoOrder = (leafA, leafB) => this.order.indexOf(leafA.id) - this.order.indexOf(leafB.id)
    const leavesByLongest = pickLeavesByLongest(this.layoutNodes)
    const longestStemLength = leavesByLongest[0].stem.pickMostAccurateTotal()
    const arrangedLeaves = leavesByLongest.sort(intoOrder)

    const rows = arrangedLeaves.map(leaf => {
      const magnitude = leaf.stem.pickMostAccurateTotal()
      const units = parseInt((magnitude / longestStemLength) * 50)
      const lengthAsDashes = new Array(units).fill('-').join('')
      const nodeGenealogy = [...leaf.stem.ancestors.ids, leaf.id].join('.')
      return [nodeGenealogy, lengthAsDashes + ' ' + magnitude]
    })

    const toLongest = (a, b) => a > b ? a : b
    const longestGenealogy = rows.map(row => row[0].length).reduce(toLongest, 0)
    const normalize = row => {
      while (row[0].length < longestGenealogy) {
        row[0] += ' '
      }
    }
    rows.forEach(normalize)
    rows.unshift([])

    return rows.map(row => row.join('  ')).join('\n')
  }
}

// ClumpPyramid heuristics:
// Clump orientation | Children insertion when siblings are present
// __________________|______________________________________________
// lhs               | ascending => unshift (the / of /^\)
// centered          | nextPyramidSide => unshift || push (the ^ of /^\)
// rhs               | descending => push (the \ of /^\)
// * Leaves are inserted longest to shortest (as per totalStemLength)
// * Leaves' ancestors are represented by Clumps (arrays [] of Leaves and other Clumps) and are created if missing (in ground-up order, from Root to leaf's parent, i.e. R->C->C->C->C->L converts to [[[[[L]]]]])
// * Clumps within Clumps count as siblings to inserted leaves (i.e. quite common to see [L, [L], L])

// Simplified example:
// Leaves with ids 1..8, sorted by totalStemLength, result in following tree:
//
//           R
//           |
//           C
//          /|
//         C C\
//        /  | \
//       C   C  C
//      /    |   \
//     C    /C    \
// 6 _/    8 |\    C_ 7
//   /       | \   |\
//  3        C  4  | 5
//           |     2
//           1

// Walkthrough:
// Leaf | Missing ancestor Clumps formed | Clump orientation   | Leaf insertion factor
// _____|________________________________|_____________________|____________________________________
// 1    | 6 (including Root)             | first=center        | longest=first=n/a
// 2    | 2                              | nextPyramidSide=rhs | first-in-clump=n/a
// 3    | 3                              | nextPyramidSide=lhs | first-in-clump=n/a
// 4    | - (parent clump exists)        | center (^)          | clumpSlant=nextPyramidSide=push (not first-in-clump because sibling clump is present)
// 5    | - (parent clump exists)        | rhs (\)             | clumpSlant=push
// 6    | - (parent clump exists)        | lhs (/)             | clumpSlant=unshift
// 7    | - (parent clump exists)        | rhs (\)             | clumpSlant=push
// 8    | - (parent clump exists)        | center (^)          | clumpSlant=nextPyramidSide=unshift
class ClumpPyramid {
  constructor (layout) {
    this.layout = layout
    this.layoutNodes = layout.layoutNodes
    this.insertionSideToOrientation = {
      unshift: 'lhs',
      push: 'rhs'
    }
    this.orientationToInsertionSide = {
      lhs: 'unshift',
      rhs: 'push'
    }
    this.emptyPyramid()
  }

  emptyPyramid () {
    this.leavesOnSide = {
      lhs: 0,
      center: 0,
      rhs: 0
    }

    this.clumpById = {}
    this.leadingLeaf = null
  }

  nextPyramidSide () {
    return this.leavesOnSide.lhs < this.leavesOnSide.rhs ? 'unshift' : 'push'
  }

  setAncestorClump (leaf, ancestorId, insertAtSide) {
    if (this.clumpById[ancestorId]) {
      return
    }

    // Create non-existent ancestor clump
    this.clumpById[ancestorId] = []

    // Assign orientation in relation to centered leaf
    // Note - first (i.e. longest) leaf will always be centered, thus its ancestor clumps have center orientation
    const clumpOrientation = leaf === this.leadingLeaf ? 'center' : this.insertionSideToOrientation[insertAtSide]
    this.clumpById[ancestorId].orientation = clumpOrientation

    // Insert newly-created ancestor clump into its direct-parent clump
    // Note - root will have no parent
    const ancestor = this.layoutNodes.get(ancestorId)
    const ancestorParent = ancestor ? ancestor.parent : null
    if (ancestorParent) {
      this.clumpById[ancestorParent.id][insertAtSide](this.clumpById[ancestorId])
    }
  }

  setLeaves (leavesByLongest) {
    const roots = []
    this.emptyPyramid()
    this.leadingLeaf = leavesByLongest[0]
    for (const layoutNodeLeaf of leavesByLongest) {
      let insertAtSide = this.nextPyramidSide()
      const leaf = layoutNodeLeaf
      const stem = layoutNodeLeaf.stem

      const ancestors = stem.ancestors.ids.length ? stem.ancestors.ids : [leaf.parentId]
      for (const ancestorId of ancestors) {
        this.setAncestorClump(leaf, ancestorId, insertAtSide)
        const ancestorLayoutNode = this.layoutNodes.get(ancestorId)
        if (!ancestorLayoutNode || !ancestorLayoutNode.parent) {
          if (!roots.includes(ancestorId)) {
            roots[insertAtSide](ancestorId)
          }
        }
      }

      const parentClump = this.clumpById[layoutNodeLeaf.parent ? layoutNodeLeaf.parent.id : 0]

      // TODO: find out why at aggregateNode level sometimes there's a node on its own like this
      if (!parentClump) continue

      if (parentClump.orientation !== 'center') {
        insertAtSide = this.orientationToInsertionSide[parentClump.orientation]
      }
      parentClump[insertAtSide](leaf.id)
      const updateSide = leaf === this.leadingLeaf ? 'center' : this.insertionSideToOrientation[insertAtSide]
      this.leavesOnSide[updateSide]++
    }

    this.order = arrayFlatten(roots.map(rootId => arrayFlatten(this.clumpById[rootId])))
  }
}

module.exports = Positioning
