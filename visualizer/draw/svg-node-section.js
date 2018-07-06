'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const { validateNumber } = require('../validation.js')

class SvgNodeSection {
  constructor (parentContent, settings) {
    this.parentContent = parentContent
    this.ui = parentContent.ui

    const {
      dataPosition,
      shapeClass
    } = settings
    this.dataPosition = dataPosition
    this.shapeClass = shapeClass
  }

  setData (layoutNode) {
    this.layoutNode = layoutNode
  }

  initializeFromData () {
    this.d3NodeGroup = this.parentContent.d3NodeGroup

    if (this.shapeClass === 'SvgBubble') {
      this.d3InnerCircle = this.d3NodeGroup.append('circle')
        .classed('inner-circle', true)
    }

    const svgNodeElementClasses = {
      SvgLine,
      SvgBubble
    }

    const SvgNodeElementClass = svgNodeElementClasses[this.shapeClass]

    this.byParty = new SvgNodeElementClass(this, this.d3NodeGroup, 'party')
      .setData(this.layoutNode)
      .initializeFromData()

    this.byType = new SvgNodeElementClass(this, this.d3NodeGroup, 'typeCategory')
      .setData(this.layoutNode)
      .initializeFromData()
  }

  animate (svgNodeAnimations, isExpanding) {
    this.byParty.animate(svgNodeAnimations, isExpanding)
    this.byType.animate(svgNodeAnimations, isExpanding)
  }

  draw () {
    // In case this was too small to show on page load, but screen has been resized up, and now it's big enough
    if (!this.byParty) this.initializeFromData()

    this.byParty.draw()
    this.byType.draw()

    if (this.d3InnerCircle) {
      this.d3InnerCircle
        .attr('cx', this.parentContent.circleCentre.x)
        .attr('cy', this.parentContent.circleCentre.y)
        .attr('r', Math.max(this.parentContent.getRadius() - this.ui.settings.lineWidth * 4, 0))
    }
  }
}

class SvgNodeElement {
  constructor (parentContent, d3Group, dataType) {
    this.svgNode = parentContent.parentContent
    this.d3Group = d3Group
    this.ui = parentContent.ui

    this.dataPosition = parentContent.dataPosition
    this.dataType = dataType
  }
  setData (layoutNode) {
    this.decimalsArray = layoutNode.node.getDecimalsArray(this.dataType, this.dataPosition)

    return this
  }

  getRadius (layoutNode) {
    return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
  }

  getLength (layoutNode) {
    return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime())
  }
}

class SvgLine extends SvgNodeElement {
  initializeFromData () {
    const d3Enter = this.d3Group.selectAll('path.segmented-line')
      .data(this.decimalsArray)
      .enter()

    const classPrepend = this.dataType === 'typeCategory' ? 'type' : 'party'
    const highlightEvent = this.dataType === 'typeCategory' ? 'highlightType' : 'highlightParty'

    this.d3Shapes = d3Enter.append('path')
      .attr('class', decimal => `line-segment ${classPrepend}-${decimal[0]}`)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', decimal => this.ui.emit(highlightEvent, decimal[0]))
      .on('mouseout', () => this.ui.emit(highlightEvent, null))

    return this
  }

  setCoordinates () {
    this.degrees = this.svgNode.degrees
    this.length = this.svgNode.drawType === 'squash' ? Math.max(this.svgNode.getLength(), 1) : this.svgNode.getLength()

    let degrees
    let length
    if (this.svgNode.drawType === 'labelOnLine') {
      degrees = this.degrees + 90 * (this.svgNode.flipLabel ? -1 : 1)
      length = this.ui.settings.lineWidth * (this.dataType === 'typeCategory' ? 4 : 2)
    } else {
      const onLeftSide = (this.svgNode.flipLabel && this.dataType === 'typeCategory') || (!this.svgNode.flipLabel && this.dataType !== 'typeCategory')
      degrees = this.degrees + 90 * (onLeftSide ? -1 : 1)
      length = this.ui.settings.lineWidth
    }

    const toOrigin = new LineCoordinates({
      x1: this.svgNode.originPoint.x,
      y1: this.svgNode.originPoint.y,
      degrees,
      length
    })

    this.originPoint = {
      x: toOrigin.x2,
      y: toOrigin.y2
    }
    return this
  }

  animate (svgNodeAnimations, isExpanding) {
    this.setCoordinates()

    const dataNode = this.svgNode.layoutNode.node
    const contractedSvgNode = this.ui.parentUI.svgNodeDiagram.svgNodes.get(this.ui.layoutNode.id)

    let nodeWasBetweenInParent
    // Check if this node should animate to/from the line (was from 'between data' in parent) or the arc (was within & big enough to be visible)
    if (contractedSvgNode.drawType === 'squash') {
      nodeWasBetweenInParent = true
    } else {
      switch (dataNode.constructor.name) {
        case 'ShortcutNode':
          // Nothing to animate, so return and skip the rest of this method
          return
        case 'AggregateNode':
          nodeWasBetweenInParent = dataNode.isBetweenClusters
          break
        case 'ArtificialNode':
          nodeWasBetweenInParent = dataNode.contents.some(collapsedDataNode => collapsedDataNode.isBetweenClusters)
          break
        default:
          // Cluster nodes are between cluster nodes by definition
          nodeWasBetweenInParent = true
          break
      }
    }

    const contractedOrigin = nodeWasBetweenInParent ? cloneXY(contractedSvgNode.originPoint) : defaultArcOrigin()
    const expandedOrigin = cloneXY(this.originPoint)

    const overallLength = contractedSvgNode.getLength()
    const parentBetweenTime = contractedSvgNode.layoutNode.node.getBetweenTime()
    const parentWithinTime = contractedSvgNode.layoutNode.node.getWithinTime()
    const degrees = contractedSvgNode.degrees

    let parentBubble
    if (!nodeWasBetweenInParent) {
      const dataTypeKey = this.dataType === 'typeCategory' ? 'byType' : 'byParty'
      parentBubble = contractedSvgNode.syncBubbles[dataTypeKey]
    }

    this.d3Shapes.each((segmentDatum, index, nodes) => {
      svgNodeAnimations.push(new Promise((resolve, reject) => {
        const d3LineSegment = d3.select(nodes[index])

        const nodeBetweenTime = this.svgNode.layoutNode.node.getBetweenTime()
        const parentTime = nodeWasBetweenInParent ? parentBetweenTime : parentWithinTime
        const segmentDecimalOfParentTime = (nodeBetweenTime / parentTime) * segmentDatum[1]

        let contractedPath

        if (nodeWasBetweenInParent) {
          contractedPath = getLineUpdatingOrigin(contractedOrigin, degrees, overallLength * segmentDecimalOfParentTime)
        } else {
          contractedPath = getArcUpdatingAngle(contractedOrigin, segmentDecimalOfParentTime, parentBubble)
        }

        const expandedPath = getLineUpdatingOrigin(expandedOrigin, this.degrees, this.length * segmentDatum[1])

        const startPath = isExpanding ? contractedPath : expandedPath
        const endPath = isExpanding ? expandedPath : contractedPath

        d3LineSegment.attr('d', startPath)

        const d3Transition = d3LineSegment.transition()
          .duration(this.ui.settings.animationDuration)
          .on('end', () => {
            resolve(segmentDatum)
          })

        if (!nodeWasBetweenInParent) {
          const endArc = unpackArcString(endPath)
          if (endArc) {
            d3Transition.attrTween('d', tweenArcToLine(endArc, parentBubble.arcMaker, this.ui.settings.animationEasing, isExpanding))
            return
          }
        }
        d3Transition
          .ease(this.ui.settings.animationEasing)
          .attr('d', endPath)
      }))
    })
  }

  draw () {
    this.setCoordinates()

    const currentOrigin = cloneXY(this.originPoint)

    this.d3Shapes.each((segmentDatum, index, nodes) => {
      const d3LineSegment = d3.select(nodes[index])

      const segmentPath = getLineUpdatingOrigin(currentOrigin, this.degrees, this.length * segmentDatum[1])

      d3LineSegment.attr('d', segmentPath)
    })
  }
}

class SvgBubble extends SvgNodeElement {
  setData (layoutNode) {
    super.setData(layoutNode)
    this.arcData = d3.pie().value((arcDatum) => arcDatum[1])(this.decimalsArray)
    return this
  }

  initializeFromData () {
    const d3Enter = this.d3Group.selectAll('path.segmented-bubble')
      .data(this.arcData)
      .enter()

    const classPrepend = this.dataType === 'typeCategory' ? 'type' : 'party'
    const highlightEvent = this.dataType === 'typeCategory' ? 'highlightType' : 'highlightParty'

    this.d3Shapes = d3Enter.append('path')
      .attr('class', arcDatum => `line-segment ${classPrepend}-${arcDatum.data[0]}`)
      .style('stroke-width', this.ui.settings.lineWidth)
      .on('mouseover', arcDatum => this.ui.emit(highlightEvent, arcDatum.data[0]))
      .on('mouseout', () => this.ui.emit(highlightEvent, null))

    return this
  }

  setCoordinates () {
    this.circleCentre = this.svgNode.circleCentre
    this.radius = this.svgNode.getRadius() - (this.dataType === 'typeCategory' ? this.ui.settings.lineWidth * 2 : 0)
    this.arcMaker = d3.arc()
      .innerRadius(this.radius)
      .outerRadius(this.radius)
  }

  animate (svgNodeAnimations, isExpanding) {
  }

  draw () {
    this.setCoordinates()

    this.d3Shapes
      .attr('d', arcDatum => {
        const initialArc = this.arcMaker(arcDatum)
        const adjustedArc = adjustArcPath(initialArc, this)
        return adjustedArc
      })
  }
}

function cloneXY (originPoint) {
  const { x, y } = originPoint
  return { x, y }
}

function defaultArcOrigin () {
  return {
    // Radians from top of circle, like D3 pie/arc
    startAngle: 0,
    endAngle: 0
  }
}

function getArcUpdatingAngle (arcOrigin, decimal, targetBubble) {
  const angleIncrement = (2 * Math.PI) * decimal

  arcOrigin.endAngle += angleIncrement
  const arcDatum = Object.assign({
    value: decimal,
    padAngle: 0
  }, arcOrigin)

  const initialArc = targetBubble.arcMaker(arcDatum)
  const adjustedArc = adjustArcPath(initialArc, targetBubble)

  arcOrigin.startAngle += angleIncrement
  return adjustedArc
}

function getLineUpdatingOrigin (origin, degrees, length) {
  const line = new LineCoordinates({
    x1: origin.x,
    y1: origin.y,
    degrees,
    length
  })

  origin.x = line.x2
  origin.y = line.y2

  const radians = getEllipseAngle(degrees)

  // Straight line as an SVG arc path so it can be animated to/from donut segments
  const pathDef = `M ${line.x1},${line.y1} A 0,0,${radians},0,1,${line.x2},${line.y2}`
  return pathDef
}

function adjustArcPath (arcString, svgElement) {
  const {
    x,
    y
  } = svgElement.circleCentre
  const radians = getEllipseAngle(svgElement.svgNode.degrees)

  const arcDef = unpackArcString(arcString) || addMissingADefs(arcString)
  if (!arcDef) return arcString

  // Add circle centre coords to path absolute coords so we don't need a transform
  arcDef.M[0] = parseFloat(arcDef.M[0]) + x
  arcDef.M[1] = parseFloat(arcDef.M[1]) + y

  arcDef.A[2] = radians

  arcDef.A[5] = parseFloat(arcDef.A[5]) + x
  arcDef.A[6] = parseFloat(arcDef.A[6]) + y

  const adjustedArcString = `M ${arcDef.M.join(',')} A ${arcDef.A.join(',')}`

  if (!arcDef.A2) return adjustedArcString

  arcDef.A2[5] = parseFloat(arcDef.A2[5]) + x
  arcDef.A2[6] = parseFloat(arcDef.A2[6]) + y

  return adjustedArcString + ` A ${arcDef.A2.join(',')}`
}

function addMissingADefs (arcString) {
  // Very short arc segments can be drawn by D3 arcmakers as L or even M0,0Z
  if (arcString === 'M0,0Z') return unpackArcString('M 0,0 A 0,0,0,0,1,0,0')

  const splitString = arcString.split('L')
  const adjustedArcString = `${splitString[0]} A 0,0,0,0,1,${splitString[1]}`
  return unpackArcString(adjustedArcString)
}

function unpackArcString (arcString) {
  const arcDef = {}

  const splitString = arcString.split('A')
  if (splitString.length <= 1) return null

  arcDef.M = splitString[0].slice(1).split(',')

  // The second A of a typical D3 arc where innerRadius === outerRadius retraces itself to the start
  // We can therefore discard it because it's invisible to the user and complicates animation
  arcDef.A = splitString[1].split(',')

  // Complete circles in D3 arcs are drawn as two outward semi-circles, then two retracing semi-circles
  // We keep the second semi-circle, and discard the redundant third and fourth retracing semi-circles
  arcDef.A2 = splitString.length > 3 ? splitString[2].split(',') : null
  return arcDef
}

// tweenArcToLine is called on creating transition, passing params to the functions D3 handles
function tweenArcToLine (endArc, svgElement, ease, isExpanding) {
  const arcMaker = svgElement.arcMaker

  // This factory function defines the interpolator function and returns it to d3's attrTween
  return function tweenFactory (arcDatum) {
    const d3Path = d3.select(this)

    // This is the interpolator function used by the D3 transition on each animation frame
    return function tweenInterpolator (time) {
      const easedTime = ease(time)
      const currentArc = unpackArcString(d3Path.attr('d'))

      const interpolate = (key, index, exponential) => {
        const currentValue = parseFloat(currentArc[key][index])
        const endValue = parseFloat(endArc[key][index])
        const interpolated = d3.interpolateNumber(currentValue, endValue)(easedTime)

        for (const [label, value] of [['current', currentValue], ['end', endValue], ['interpolated', interpolated]]) {
          validateNumber(value, `Interpolation ${key} ${index}, ${label} value: `)
        }
        return interpolated
      }

      if (currentArc.A2) {
        // Animate co-ordinates for one almost-complete arc, not two complete semi-circles
        const singleArc = arcMaker({
          startAngle: 0,
          endAngle: LineCoordinates.degreesToRadians(359),
          padAngle: 0
        })

        Object.assign(currentArc, unpackArcString(adjustArcPath(singleArc, svgElement)))
      }

      const currentLine = new LineCoordinates({
        x1: interpolate('M', 0),
        y1: interpolate('M', 1),
        x2: interpolate('A', 5),
        y2: interpolate('A', 6)
      })

      const interpolatedArc = {
        M: [
          numberForSVG(currentLine.x1, 'Move to X'),
          numberForSVG(currentLine.y1, 'Move to Y')
        ],
        A: [
          numberForSVG(interpolate('A', 0), 'Arc ellipse rx'),
          numberForSVG(interpolate('A', 1) * (isExpanding ? 1 - time : time), 'Arc ellipse ry'),

          numberForSVG(currentLine.degrees, 'Arc ellipse rotation'),

          numberForSVG(parseInt((isExpanding ? currentArc : endArc).A[3]), 'Arc binary large-arc flag'),
          numberForSVG(parseInt((isExpanding ? currentArc : endArc).A[4]), 'Arc binary sweep flag'),

          numberForSVG(currentLine.x2, 'Arc endpoint X'),
          numberForSVG(currentLine.y2, 'Arc endpoint Y')
        ]
      }

      const interpolatedArcString = `M ${interpolatedArc.M.join(',')} A ${interpolatedArc.A.join(',')}`

      svgElement.firstTween = true

      // This return value is applied each animation frame
      return interpolatedArcString
    }
  }
}

function numberForSVG (number, description, isInteger = false) {
  validateNumber(number, description)
  // Prevent JS inserting number as scientific notation, which SVG string can't handle
  // Also prevent small decimals <0.1 which can make the ellipse radii go haywire
  return ('' + number).includes('e') ? parseFloat(number.toFixed(1)) : number
}

function getEllipseAngle (degrees) {
  return LineCoordinates.degreesToRadians(degrees + 90)
}

module.exports = SvgNodeSection
