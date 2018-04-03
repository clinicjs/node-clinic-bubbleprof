'use strict'

// Modified version of https://gist.github.com/samgiles/762ee337dff48623e729#gistcomment-2128332
function flatMapDeep (value) {
  return Array.isArray(value) ? [].concat(...value.map(x => flatMapDeep(x))) : value
}

class Positioning {
  constructor (nodes) {
    this.nodes = nodes
  }
  pickLeavesByLongest () {
    const byLongest = (leafA, leafB) => leafB.stem.getTotalStemLength() - leafA.stem.getTotalStemLength()
    const byLeafOnly = node => !node.children.length
    return this.nodes.filter(byLeafOnly).sort(byLongest)
  }
  formClumpPyramid () {
    const leavesByLongest = this.pickLeavesByLongest()
    const clumpPyramid = new ClumpPyramid()
    clumpPyramid.setLeaves(leavesByLongest)
    this.order = clumpPyramid.order
  }
  debugInspect () {
    const intoOrder = (leafA, leafB) => this.order.indexOf(leafA.id) - this.order.indexOf(leafB.id)
    const arrangedLeaves = this.pickLeavesByLongest().sort(intoOrder)

    const rows = arrangedLeaves.map(leaf => {
      const magnitude = leaf.stem.getTotalStemLength()
      const units = parseInt(magnitude / 25)
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
//           1
//           |     2
//  3        C  4  | 5
//   \       | /   |/
// 6 _\    8 |/    C_ 7
//     C    \C    /
//      \    |   /
//       C   C  C
//        \  | /
//         C C/
//          \|
//           C
//           |
//           R

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
  constructor () {
    this.insertionSideToOrientation = {
      'unshift': 'lhs',
      'push': 'rhs'
    }
    this.orientationToInsertionSide = {
      'lhs': 'unshift',
      'rhs': 'push'
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
  ensureAncestorClump (leaf, ancestorId, insertAtSide) {
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
    const ancestor = leaf.getSameType(ancestorId)
    const ancestorParent = ancestor.getParentNode()
    if (ancestorParent) {
      this.clumpById[ancestorParent.id][insertAtSide](this.clumpById[ancestorId])
    }
  }
  setLeaves (leavesByLongest) {
    this.emptyPyramid()
    this.leadingLeaf = leavesByLongest[0]
    for (const leaf of leavesByLongest) {
      let insertAtSide = this.nextPyramidSide()

      for (const ancestorId of leaf.stem.ancestors.ids) {
        this.ensureAncestorClump(leaf, ancestorId, insertAtSide)
      }

      const parentClump = this.clumpById[leaf.parentId]
      if (parentClump.orientation !== 'center') {
        insertAtSide = this.orientationToInsertionSide[parentClump.orientation]
      }
      parentClump[insertAtSide](leaf.id)
      const updateSide = leaf === this.leadingLeaf ? 'center' : this.insertionSideToOrientation[insertAtSide]
      this.leavesOnSide[updateSide]++
    }

    const rootId = 1
    this.order = flatMapDeep(this.clumpById[rootId])
  }
}

module.exports = Positioning
