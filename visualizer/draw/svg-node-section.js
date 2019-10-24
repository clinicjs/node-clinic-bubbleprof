'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const { validateNumber } = require('../validation.js')

class SvgNodeSection {
  constructor (parentContent, settings) {
    this.parentContent = parentContent
    this.ui = parentContent.ui
    this.layoutNode = parentContent.layoutNode

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

  animate (svgNodeAnimations, isExpanding) {
    this.setCoordinates()

    const dataNode = this.svgNode.layoutNode.node
    const contractedSvgNode = this.ui.parentUI.svgNodeDiagram.svgNodes.get(this.ui.layoutNode.id)

    const dataTypeKey = this.dataType === 'typeCategory' ? 'byType' : 'byParty'
    const contractedSvgLineElement = contractedSvgNode.asyncBetweenLines[dataTypeKey]

    const elementProperties = {
      isExpanding,
      contractedSvgNode,
      parentBubble: contractedSvgNode.syncBubbles[dataTypeKey],
      overallLength: contractedSvgNode.getLength(),
      parentBetweenTime: contractedSvgNode.layoutNode.node.getBetweenTime(),
      parentWithinTime: contractedSvgNode.layoutNode.node.getWithinTime(),
      expandedOrigin: cloneXY(this.originPoint || this.circleCentre),
      contractedOrigin: null,
      nodeWasBetweenInParent: null
    }

    // Check if this node should animate to/from the line (was from 'between data' in parent) or the arc (was within & big enough to be visible)
    if (this.constructor.name === 'SvgBubble') {
      elementProperties.nodeWasBetweenInParent = false
    } else {
      switch (dataNode.constructor.name) {
        case 'ShortcutNode':
          // Nothing to animate, so return and skip the rest of this method
          return
        case 'AggregateNode':
          elementProperties.nodeWasBetweenInParent = dataNode.isBetweenClusters
          break
        case 'ArtificialNode':
          elementProperties.nodeWasBetweenInParent = dataNode.contents.some(collapsedDataNode => collapsedDataNode.isBetweenClusters)
          break
        default:
          // Cluster nodes are between cluster nodes by definition
          elementProperties.nodeWasBetweenInParent = true
          break
      }
    }

    elementProperties.contractedOrigin = elementProperties.nodeWasBetweenInParent ? cloneXY(contractedSvgLineElement.originPoint) : defaultArcOrigin()

    const segmentAnimations = []
    this.d3Shapes.each((segmentDatum, index, nodes) => {
      const d3LineSegment = d3.select(nodes[index])

      const segmentAnimator = new Promise((resolve) => {
        this.animateSegment(segmentDatum, d3LineSegment, resolve, elementProperties)
      }).catch((err) => {
        err.message += `. For segment ${index}`
        throw err
      })
      segmentAnimations.push(segmentAnimator)
    })

    svgNodeAnimations.push(Promise.all(segmentAnimations).then(() => {
      // Apply completed state. e.g. if it is a complete circle, two semi-circle Arcs replace one 359 degree Arc
      this.draw()
    }, (err) => {
      err.message += `. Animating ${this.dataType} ${this.constructor.name} for ${this.svgNode.layoutNode.id}. `
      throw err
    }))
  }

  animateSegment (segmentDatum, d3LineSegment, resolveSegment, elementProperties) {
    const {
      isExpanding,
      contractedSvgNode,
      parentBubble,
      overallLength,
      parentBetweenTime,
      parentWithinTime,
      expandedOrigin,
      contractedOrigin,
      nodeWasBetweenInParent
    } = elementProperties

    const degrees = contractedSvgNode.degrees

    const segmentDecimal = this.constructor.name === 'SvgBubble' ? segmentDatum.data[1] : segmentDatum[1]
    const nodeTime = this.svgNode.layoutNode.node[(this.constructor.name === 'SvgBubble' ? 'getWithinTime' : 'getBetweenTime')]()
    const parentTime = nodeWasBetweenInParent ? parentBetweenTime : parentWithinTime
    const segmentDecimalOfParentTime = parentTime ? (nodeTime / parentTime) * segmentDecimal : 1

    let contractedPath
    let arcDatum
    if (nodeWasBetweenInParent) {
      contractedPath = getLineUpdatingOrigin(contractedOrigin, degrees, overallLength * segmentDecimalOfParentTime)
    } else {
      const arcIncrement = getArcUpdatingAngle(contractedOrigin, segmentDecimalOfParentTime, parentBubble)
      contractedPath = arcIncrement.arcString
      arcDatum = arcIncrement.arcDatum
    }

    let expandedPath
    if (this.constructor.name === 'SvgBubble') {
      const arcObject = unpackArcString(adjustArcPath(this.arcMaker(segmentDatum), this))
      removeA2FromPath(arcObject, this)
      expandedPath = repackArcString(arcObject)
    } else {
      expandedPath = getLineUpdatingOrigin(expandedOrigin, this.degrees, this.length * segmentDatum[1])
    }

    const startPath = isExpanding ? contractedPath : expandedPath
    const endPath = isExpanding ? expandedPath : contractedPath

    d3LineSegment.attr('d', startPath)

    const d3Transition = d3LineSegment.transition()
      .duration(this.ui.settings.animationDuration)
      .on('end', () => {
        resolveSegment(segmentDatum)
      })

    if (!nodeWasBetweenInParent && this.constructor.name === 'SvgLine') {
      const endArc = unpackArcString(endPath)
      if (endArc) {
        d3Transition.attrTween('d', tweenArcToLine(endArc, parentBubble.arcMaker, this.ui.settings.animationEasing, isExpanding))
        return
      }
    }

    if (this.constructor.name === 'SvgBubble') {
      d3Transition.attrTween('d', tweenArcToArc(arcDatum, parentBubble, this, this.ui.settings.animationEasing, isExpanding))
      return
    }

    d3Transition
      .ease(this.ui.settings.animationEasing)
      .attr('d', endPath)
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
      .style('stroke-width', this.ui.settings.lineWidth + (this.dataType === 'typeCategory' ? 1.5 : -0.5))
      .on('mouseover', decimal => this.ui.emit(highlightEvent, decimal[0]))
      .on('mouseout', () => this.ui.emit(highlightEvent, null))

    return this
  }

  setCoordinates () {
    this.degrees = this.svgNode.degrees
    this.length = this.svgNode.getLength()

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
      .style('stroke-width', this.ui.settings.lineWidth + (this.dataType === 'typeCategory' ? 1.5 : -0.5))
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

  draw () {
    this.setCoordinates()
    this.d3Shapes.attr('d', arcDatum => {
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
  return {
    arcDatum,
    arcString: adjustedArc
  }
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

  const arcDef = unpackArcString(arcString)
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
  // Very short arc segments can be drawn by D3 arcmakers as a L line, or M[X],[Y]Z where X and Y are usually tiny or 0
  // or in some cases with A 0 A 0 empty arcs
  const splitByL = arcString.split('L')
  if (splitByL.length > 1) {
    const lastCharIndex = splitByL[1].length - 1
    const endString = splitByL[1].charAt(lastCharIndex) === 'Z' ? splitByL[1].slice(0, lastCharIndex) : splitByL[1]
    const adjustedArcString = `${splitByL[0]} A 0,0,0,0,1,${endString}`
    return unpackArcString(adjustedArcString)
  }

  const firstStringSection = arcString.split(/(?=[MLAZ])/)[0].trim()
  return unpackArcString(`${firstStringSection} A 0,0,0,0,1,0,0`)
}

function splitBySvgSeparator (substring) {
  const byComma = substring.trim().split(',')

  // MS Edge writes SVG seperated by spaces not commas e.g. 'M 1.23 4.56' not 'M 1.23,4.56'
  return byComma.length > 1 ? byComma : byComma[0].split(' ')
}

function unpackArcString (initialString, alreadyFiltered = false) {
  const zRemoved = initialString.charAt(initialString.length - 1) === 'Z' ? initialString.slice(0, initialString.length - 1) : initialString
  const arcArray = zRemoved.split(/(?=[MA])/)

  const unfilteredArc = {
    M: [],
    A: []
  }
  arcArray.forEach(subStr => {
    if (subStr.charAt(0) === 'M') unfilteredArc.M.push(splitBySvgSeparator(subStr.slice(1).trim()))
    if (subStr.charAt(0) === 'A') unfilteredArc.A.push(splitBySvgSeparator(subStr.slice(1).trim()))
  })

  const filteredArc = {
    M: unfilteredArc.M[0],
    A: unfilteredArc.A[0],
    A2: unfilteredArc.A.length === (alreadyFiltered ? 2 : 4) ? unfilteredArc.A[1] : null
  }
  return filteredArc.A && filteredArc.A.length === 7 ? filteredArc : addMissingADefs(initialString)
}

function repackArcString (arcObject) {
  const arcString = `M ${arcObject.M.join(',').trim()} A ${arcObject.A.join(',').trim()}`
  return arcObject.A2 ? arcString + ` A ${arcObject.A2.join(',')}` : arcString
}

function tweenArcToLine (endArc, svgElement, ease, isExpanding) {
  // Factory function is passed to D3, given D3 context and passes interpolator function to d3's attrTween
  return function lineTweenFactory (arcDatum) {
    const d3Path = d3.select(this)

    // This is the interpolator function used by the D3 transition on each animation frame
    return function lineTweenInterpolator (time) {
      const easedTime = ease(time)
      const currentArc = unpackArcString(d3Path.attr('d'))

      const interpolate = (key, index, exponential) => {
        const currentValue = parseFloat(currentArc[key][index])
        const endValue = parseFloat(endArc[key][index])
        const interpolated = d3.interpolateNumber(currentValue, endValue)(easedTime)

        for (const [label, value] of [['current', currentValue], ['end', endValue], ['interpolated', interpolated]]) {
          validateNumber(value, `Interpolation ${key} ${index}, ${label} value`)
        }
        return interpolated
      }

      if (currentArc.A2) removeA2FromPath(currentArc, svgElement)

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

      const interpolatedArcString = repackArcString(interpolatedArc)

      svgElement.firstTween = true

      // This return value is applied each animation frame
      return interpolatedArcString
    }
  }
}

function tweenArcToArc (contractedArcDatum, contractedBubble, expandedBubble, ease, isExpanding) {
  // Factory function is passed to D3, given D3 context and passes interpolator function to d3's attrTween
  return function arcTweenFactory (expandedArcDatum, b, c) {
    const interpolateStartAngle = d3.interpolateNumber(contractedArcDatum.startAngle, expandedArcDatum.startAngle)
    const interpolateEndAngle = d3.interpolateNumber(contractedArcDatum.endAngle, expandedArcDatum.endAngle)
    const interpolateValue = d3.interpolateNumber(contractedArcDatum.value, expandedArcDatum.value)

    const interpolateRadius = d3.interpolateNumber(contractedBubble.radius, expandedBubble.radius)
    const interpolateX = d3.interpolateNumber(contractedBubble.circleCentre.x, expandedBubble.circleCentre.x)
    const interpolateY = d3.interpolateNumber(contractedBubble.circleCentre.y, expandedBubble.circleCentre.y)
    const interpolateDegrees = d3.interpolateNumber(contractedBubble.svgNode.degrees, expandedBubble.svgNode.degrees)

    // This is the interpolator function used by the D3 transition on each animation frame
    return function arcTweenInterpolator (time) {
      const easedTime = ease(isExpanding ? time : 1 - time)

      const interpolatedArcDatum = {
        value: interpolateValue(easedTime),
        startAngle: interpolateStartAngle(easedTime),
        endAngle: interpolateEndAngle(easedTime),
        padAngle: 0
      }

      const interpolatedRadius = interpolateRadius(easedTime)
      const interpolatedArcMaker = d3.arc()
        .innerRadius(interpolatedRadius)
        .outerRadius(interpolatedRadius)

      const interpolatedSvgElement = {
        circleCentre: {
          x: interpolateX(easedTime),
          y: interpolateY(easedTime)
        },
        svgNode: {
          degrees: interpolateDegrees(easedTime)
        },
        arcMaker: interpolatedArcMaker
      }

      const rawArcString = interpolatedArcMaker(interpolatedArcDatum)
      const adjustedArcString = adjustArcPath(rawArcString, interpolatedSvgElement)
      const arcObject = unpackArcString(adjustedArcString, true)

      if (arcObject.A2) removeA2FromPath(arcObject, interpolatedSvgElement)

      const arcString = repackArcString(arcObject)
      return arcString
    }
  }
}

function removeA2FromPath (currentArc, svgElement) {
  // Turn two complete semi-circle arcs into one almost-complete circular arc, for cleaner animation
  const singleArc = svgElement.arcMaker({
    startAngle: 0,
    endAngle: LineCoordinates.degreesToRadians(359),
    padAngle: 0
  })

  Object.assign(currentArc, unpackArcString(adjustArcPath(singleArc, svgElement)))
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
