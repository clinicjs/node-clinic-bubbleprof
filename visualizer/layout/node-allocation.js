'use strict'

const LineCoordinates = require('./line-coordinates.js')
const { validateNumber } = require('../validation.js')

class NodeAllocation {
  constructor (layout, layoutNodes, coordinatesFn = NodeAllocation.threeSided) {
    this.layout = layout
    this.layoutNodes = layoutNodes
    this.leaves = new Map()
    this.midPoints = new Map()
    this.roots = new Map()
    for (const layoutNode of layoutNodes.values()) {
      const position = {
        units: 0,
        offset: null, // Leaves only (null for midpoints)
        x: 0,
        y: 0,
        segment: null // Leaves only, used for debugging
      }
      layoutNode.position = position
      const category = layoutNode.stem.leaves.ids.length ? 'midPoints' : 'leaves'
      this[category].set(layoutNode.id, layoutNode)
    }
    for (const midPoint of this.midPoints.values()) {
      if (!midPoint.parent) {
        this.roots.set(midPoint.id, midPoint)
      }
    }
    const coordinates = coordinatesFn(this.layout, this.roots)
    this.initializeSegments(coordinates)
  }

  initializeSegments (coordinates) {
    this.segments = []
    this.total1DSpaceAvailable = 0
    for (const coordinate of coordinates) {
      const label = coordinate.label
      const line = new LineCoordinates(coordinate)
      const tail = this.segments[this.segments.length - 1]
      const begin = coordinate === coordinates[0] ? 0 : tail.end
      this.segments.push(new LinearSpaceSegment(label, begin, line))
      this.total1DSpaceAvailable += line.length
    }
  }

  static threeSided (layout, roots) {
    const { svgWidth, svgDistanceFromEdge } = layout.settings
    const { finalSvgHeight } = layout.scale
    const toLargestDiameter = (largest, rootLayoutNode) => Math.max(largest, rootLayoutNode.stem.scaled.ownDiameter)
    const largestRootDiameter = [...roots.values()].reduce(toLargestDiameter, 0)
    const topOffset = svgDistanceFromEdge + Math.max(finalSvgHeight * 0.2, largestRootDiameter)
    const borders = {
      top: validateNumber(topOffset),
      bottom: validateNumber(finalSvgHeight - svgDistanceFromEdge),
      left: validateNumber(svgDistanceFromEdge),
      right: validateNumber(svgWidth - svgDistanceFromEdge)
    }
    const coordinates = [
      { label: 'LHS', x1: borders.left, y1: borders.top, x2: borders.left, y2: borders.bottom },
      { label: 'BOT', x1: borders.left, y1: borders.bottom, x2: borders.right, y2: borders.bottom },
      { label: 'RHS', x1: borders.right, y1: borders.bottom, x2: borders.right, y2: borders.top }
    ]
    return coordinates
  }

  process (placementMode = NodeAllocation.placementMode.LENGTH_CONSTRAINED) {
    this.convertTotalStemLengthsToUnits()
    this.calculate1DLinearOffsets()
    this.calculate2DLeafCoordinates()
    this.calculate2DMidpointCoordinates(placementMode)
    if (placementMode === NodeAllocation.placementMode.LENGTH_CONSTRAINED) {
      this.constrain2DLeafCoordinates()
    }
  }

  // Hierarchical (by depth) comparison narrows clumps internally and expands space between clumps.
  // This has proved to be more visually appealing than result of flat comparison.
  // Example:
  // 1.2     100
  // 1.3.4.5 500
  // 1.3.6.7 900
  // 1.3.6.8 500
  // In flat longest leaf comparison set: [2, 5, 7, 8], leaf 2 is allocated 5% of space (100/2000)
  // In longest leaf comparison set at depth=1: [2, 3], leaf 2 is allocated 10% of space (100/1000)
  // Subsets of nodes may not have a common ancestor and therefore cannot recursively traverse the tree root-up
  // Thus traversing depth by depth
  convertTotalStemLengthsToUnits () {
    // Traverse the hierarchies and index Clumps at each level
    const hierarchyLevels = new Map()
    for (const leafLayoutNode of this.leaves.values()) {
      const leaf = leafLayoutNode
      const stem = leafLayoutNode.stem

      const leafTotalStemLength = stem.lengths.prescaledTotal
      // Include ancestor Clumps
      const ancestors = stem.ancestors.ids.length ? stem.ancestors.ids : [leaf.parentId]
      for (let depth in ancestors) {
        depth = parseInt(depth)
        if (!hierarchyLevels.has(depth)) {
          hierarchyLevels.set(depth, new HierarchyLevel(depth))
        }
        const hierarchyLevel = hierarchyLevels.get(depth)
        // Form Clump for given node at given level
        const ancestorId = ancestors[depth]
        if (!this.midPoints.get(ancestorId)) {
          continue
        }
        const ancestorAtDepthLayoutNode = this.layoutNodes.get(ancestorId)
        const ancestorAtDepth = ancestorAtDepthLayoutNode && ancestorAtDepthLayoutNode
        if (!hierarchyLevel.clumps.has(ancestorAtDepth)) {
          const previousHierarchyLevel = hierarchyLevels.get(depth - 1)
          const parentClump = previousHierarchyLevel ? previousHierarchyLevel.clumps.get(ancestorAtDepthLayoutNode.parent && ancestorAtDepthLayoutNode.parent) : null
          const ancestorClump = new Clump(ancestorAtDepthLayoutNode, parentClump, leafTotalStemLength)
          hierarchyLevel.clumps.set(ancestorAtDepth, ancestorClump)
          if (parentClump) {
            parentClump.childClumps.set(ancestorAtDepth, ancestorClump)
          }
          continue
        }
        // Determine which leaf is longest in the Clump
        const clumpAtDepth = hierarchyLevel.clumps.get(ancestorAtDepth)
        if (!clumpAtDepth.longestLeafLength || leafTotalStemLength > clumpAtDepth.longestLeafLength) {
          clumpAtDepth.longestLeafLength = leafTotalStemLength
        }
      }
      // Include leaf Clump
      const leafDepth = ancestors.length
      if (!hierarchyLevels.has(leafDepth)) {
        hierarchyLevels.set(leafDepth, new HierarchyLevel(leafDepth))
      }
      const hierarchyLevel = hierarchyLevels.get(leafDepth)
      const previousHierarchyLevel = hierarchyLevels.get(leafDepth - 1)
      const parentClump = previousHierarchyLevel.clumps.get(leafLayoutNode.parent && leafLayoutNode.parent)
      const leafClump = new Clump(leafLayoutNode, parentClump, leafTotalStemLength)
      hierarchyLevel.clumps.set(leaf, leafClump)
      if (parentClump) {
        parentClump.childClumps.set(leaf, leafClump)
      }
    }

    // Determine portion of space to allocate for each node
    for (let depth = 0; depth < hierarchyLevels.size; ++depth) {
      const hierarchyLevel = hierarchyLevels.get(depth)
      hierarchyLevel.sumLongestLeafLengths()
      for (const clumpAtDepth of hierarchyLevel.clumps.values()) {
        const parentUnits = clumpAtDepth.parentClump ? clumpAtDepth.parentClump.units : 1
        const proportionFactor = clumpAtDepth.parentClump ? clumpAtDepth.parentClump.getTotalChildrenLongestLeafLength() : hierarchyLevel.longestLeafLengthSum

        // In some cases e.g. root node, these can be 0; if so, set as 1. TODO: investigate this further
        const clumpUnits = ((parentUnits * clumpAtDepth.longestLeafLength) || 1) / (proportionFactor || 1)
        clumpAtDepth.units = clumpAtDepth.layoutNode.validateStat(clumpUnits)
        clumpAtDepth.layoutNode.position.units = clumpUnits
      }
    }
  }

  calculate1DLinearOffsets () {
    let currentSegment = this.segments[0]
    let currentBlock = null
    const intoOrder = (leafA, leafB) => this.layout.positioning.order.indexOf(leafA.id) - this.layout.positioning.order.indexOf(leafB.id)
    const arrangedLeaves = [...this.leaves.values()].sort(intoOrder) // To be optimized (unnecessary iterations)
    for (const leafLayoutNode of arrangedLeaves) {
      const position = leafLayoutNode.position
      const allocatedSpace = position.units * this.total1DSpaceAvailable
      currentBlock = new SpaceBlock(leafLayoutNode, currentBlock ? currentBlock.end : currentSegment.begin, allocatedSpace)
      position.offset = currentBlock.center
      currentSegment = this.segments.find(segment => segment.contains1DPoint(currentBlock.center))
      currentSegment.blocks.push(currentBlock)
      currentBlock.layoutNode.position.segment = currentSegment.label
    }
  }

  calculate2DLeafCoordinates () {
    for (const segment of this.segments) {
      for (const block of segment.blocks) {
        const position = block.layoutNode.position
        const relativeOffset = block.center - segment.begin
        const { x, y } = segment.translate1DPointTo2D(relativeOffset)

        position.x = block.layoutNode.validateStat(x, 'x position')
        position.y = block.layoutNode.validateStat(y, 'y position')
      }
    }
  }

  constrain2DLeafCoordinates () {
    for (const layoutNode of this.leaves.values()) {
      const leaf = layoutNode
      const stem = layoutNode.stem

      const parentStem = layoutNode.parent && layoutNode.parent.stem
      const parentDiameter = parentStem ? parentStem.scaled.ownDiameter : 0
      const position = layoutNode.position
      const parentPosition = layoutNode.parent ? layoutNode.parent.position : this.getRootPosition(parentDiameter)
      const line = new LineCoordinates({ x1: parentPosition.x, y1: parentPosition.y, x2: position.x, y2: position.y })
      const parentRadius = parentDiameter / 2
      const thisRadius = stem.scaled.ownDiameter / 2
      const lineLength = stem.scaled.ownBetween
      const leafLength = layoutNode.node.constructor.name === 'ShortcutNode' ? this.layout.settings.shortcutLength : (lineLength + thisRadius)
      const { x, y } = line.pointAtLength(parentRadius + leafLength)

      position.x = leaf.validateStat(x)
      position.y = leaf.validateStat(y)
    }
  }

  calculate2DMidpointCoordinates (placementMode) {
    for (const layoutNode of this.midPoints.values()) {
      const midPoint = layoutNode // TODO: make naming consistent
      const stem = layoutNode.stem
      const position = layoutNode.position

      if (!layoutNode.parent) {
        // TODO: spread out x's to declutter multiple top-level nodes, preferably using this.layout.positioning.order
        const rootPosition = this.getRootPosition(stem.scaled.ownDiameter)
        position.x = midPoint.validateStat(rootPosition.x)
        position.y = midPoint.validateStat(rootPosition.y + (layoutNode.node.constructor.name === 'ShortcutNode' ? this.layout.settings.shortcutLength : 0))
        continue
      }
      const parentStem = layoutNode.parent.stem
      const parentNode = layoutNode.parent
      const parentPosition = layoutNode.parent.position

      const ownLeavesInSubset = stem.leaves.ids.filter(leafId => this.leaves.has(leafId))
      const leafPositions = ownLeavesInSubset.map(leafId => this.layoutNodes.get(leafId).position)
      midPoint.validateStat(leafPositions.length, 'leafCenter division', { aboveZero: true })
      const leafCenter = leafPositions.reduce((combinedPosition, nodePosition) => {
        return {
          x: midPoint.validateStat(combinedPosition.x + nodePosition.x),
          y: midPoint.validateStat(combinedPosition.y + nodePosition.y)
        }
      }, { x: 0, y: 0 })

      leafCenter.x /= leafPositions.length
      leafCenter.y /= leafPositions.length

      switch (placementMode) {
        case NodeAllocation.placementMode.LENGTH_CONSTRAINED: {
          const line = new LineCoordinates({ x1: parentPosition.x, y1: parentPosition.y, x2: leafCenter.x, y2: leafCenter.y })

          const parentRadius = parentNode.validateStat(parentStem.scaled.ownDiameter / 2)
          const thisRadius = midPoint.validateStat(stem.scaled.ownDiameter / 2)
          const lineLength = midPoint.validateStat(stem.scaled.ownBetween)

          const { x, y } = line.pointAtLength(parentRadius + lineLength + thisRadius)
          position.x = midPoint.validateStat(x)
          position.y = midPoint.validateStat(y)
          break
        }
        case NodeAllocation.placementMode.SPIDER: {
          const combinedCenter = {
            x: leafCenter.x + parentPosition.x / 2,
            y: leafCenter.y + parentPosition.y / 2
          }
          position.x = midPoint.validateStat(combinedCenter.x)
          position.y = midPoint.validateStat(combinedCenter.y)
          break
        }
      }
    }
  }

  getRootPosition (nodeDiameter) {
    return {
      x: this.layout.settings.svgWidth / 2,
      y: this.layout.settings.svgDistanceFromEdge + (nodeDiameter / 2)
    }
  }

  static get placementMode () {
    return {
      LENGTH_CONSTRAINED: 'LENGTH_CONSTRAINED',
      SPIDER: 'SPIDER'
    }
  }
}

class HierarchyLevel {
  constructor (depth) {
    this.depth = depth
    this.clumps = new Map()
  }

  sumLongestLeafLengths () {
    this.longestLeafLengthSum = [...this.clumps.values()].reduce((total, clump) => total + clump.longestLeafLength, 0)
  }
}

class Clump {
  constructor (layoutNode, parentClump, longestLeafLength) {
    this.parentClump = parentClump
    this.layoutNode = layoutNode
    this.childClumps = new Map()
    this.longestLeafLength = longestLeafLength
  }

  getTotalChildrenLongestLeafLength () {
    return [...this.childClumps.values()].reduce((total, clump) => total + clump.longestLeafLength, 0)
  }
}

class LinearSpaceSegment {
  constructor (label, begin, line) {
    this.label = label
    this.line = line
    this.begin = begin
    this.end = begin + line.length
    // SpaceBlock may span across multiple LinearSpaceSegments, however it will belong to the one which contains its center
    this.blocks = []
  }

  contains1DPoint (offset) {
    return this.begin < offset && offset < this.end
  }

  translate1DPointTo2D (relativeOffset) {
    return this.line.pointAtLength(relativeOffset)
  }
}

class SpaceBlock {
  constructor (layoutNode, begin, length) {
    this.layoutNode = layoutNode
    this.begin = begin
    this.end = begin + length
    this.center = begin + (length / 2)
  }
}

// TODO: debugInspect moreless like this:
//  LHS                            BOT                    RHS
// [------.---------.------------][-----------.---------][--------------.-------.------]
//        9         12                        15                        10      8

// 1.9                 LHS (o=250, u=0.43, x=0, y=250)      [------.----
// 1.2.3.4.12          LHS (o=600, u=0.43, x=0, y=600)      -----.-------
// 1.2.3.5.11.13.14.15 BOT (o=1500, u=0.43, x=500, y=1000)  -----][-----------.---------][-------
// 1.2.6.7.10          RHS (o=1750, u=0.43, x=1000, y=750)  -------.----
// 1.8                 RHS (o=2750, u=0.43, x=1000, y=250)  ---.------]

module.exports = NodeAllocation
