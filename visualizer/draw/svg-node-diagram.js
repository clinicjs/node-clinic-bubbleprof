'use strict'

const d3 = require('./d3-subset.js')
const LineCoordinates = require('../layout/line-coordinates.js')
const SvgNodeSection = require('./svg-node-section.js')

// Layout assigns each node: diameter, scaled + length, scaled + label * 2 + lineWidth

class SvgNodeDiagram {
  constructor (svgContainer) {
    this.svgContainer = svgContainer
    this.ui = svgContainer.ui

    this.svgNodes = new Map()


    this.ui.on('initializeFromData', () => {
      // Called once, creates group contents using d3's .append()
      this.initializeFromData()
    })

    this.ui.on('setData', () => {
      // Called any time the layout or ui object are changed
      this.setData()
    })

    this.ui.on('svgDraw', () => {
      // Called any time the SVG DOM elements need to be modified or redrawn
      this.draw()
    })
  }

  initializeElements () {
    this.d3Container = this.svgContainer.d3Element

    // Group to which one group for each node is appended
    this.d3Element = this.d3Container.append('g')
      .classed('node-links-wrapper', true)
  }

  setData () {
    this.dataArray = [...this.ui.layout.layoutNodes.values()]
    this.d3Enter = this.d3Element.selectAll('g.node-group')
      .data(this.dataArray)
      .enter()

    this.dataArray.forEach(layoutNode => {
      if (!this.svgNodes.has(layoutNode.id)) this.svgNodes.set(layoutNode.id, new SvgNode(this))
      this.svgNodes.get(layoutNode.id).setData(layoutNode)
    })
  }

  initializeFromData () {
    this.d3NodeGroups = this.d3Enter.append('g')
      .classed('node-group', true)
      .attr('name', layoutNode => layoutNode.id)
      .each((layoutNode, i, nodes) => {
        const d3NodeGroup = d3.select(nodes[i])

        const svgNode = this.svgNodes.get(layoutNode.id)
          .initializeFromData(d3NodeGroup)
      })
      .on('mouseover', layoutNode => this.ui.highlightNode(layoutNode))
      .on('mouseout', () => this.ui.highlightNode(null))
      .on('click', (layoutNode) => {
        d3.event.stopPropagation()
        this.ui.selectNode(layoutNode)
      })
  }
  draw () {
    this.bbox = this.d3Container.node().getBoundingClientRect()
    this.svgNodes.forEach(svgNode => svgNode.draw())
  }

  getLengthToBottom (x1, y1, degrees) {
    // Outer padding is partly for labels to use, allow encrouchment most of the way
    const distanceFromEdge = this.ui.settings.svgDistanceFromEdge / 4

    const radians = LineCoordinates.degreesToRadians(90 - degrees)
    const adjacentLength = this.bbox.height - distanceFromEdge - y1
    const hypotenuseLength = adjacentLength / Math.cos(radians)
    return hypotenuseLength
  }

  getLengthToSide (x1, y1, degrees) {
    // Outer padding is partly for labels to use, allow a little encrouchment
    const distanceFromEdge = this.ui.settings.svgDistanceFromEdge

    // Ensure degrees range is between -180 and 180
    degrees = LineCoordinates.enforceDegreesRange(degrees)
    let radians
    let adjacentLength

    if (degrees > 90 || degrees < -90) {
      // Test against left side edge
      radians = LineCoordinates.degreesToRadians(180 - degrees)
      adjacentLength = x1 - distanceFromEdge
    } else {
      // Test against right side edge
      radians = LineCoordinates.degreesToRadians(degrees)
      adjacentLength = this.bbox.width - distanceFromEdge - x1
    }
    const hypotenuseLength = adjacentLength / Math.cos(radians)
    return hypotenuseLength
  }
}

class SvgNode {
  constructor (parentContent) {
    this.parentContent = parentContent
    this.ui = parentContent.ui

    // Set and updated in .setCoordinates():
    this.strokePadding = null
    this.degrees = null
    this.originPoint = null

    this.asyncBetweenLines = new SvgNodeSection(this, {
      dataPosition: 'between',
//      dataPosition: 'asyncBetween',
      shapeClass: 'SvgLine'
    })
//  TODO: visually distinguish sync and async-within using spirals
//    this.asyncWithinLines = new SvgNodeSection(this, {
//      dataPosition: 'asyncWithin',
//      shapeClass: 'SvgSpiral'
//    })
    this.syncBubbles = new SvgNodeSection(this, {
      dataPosition: 'within',
//      dataPosition: 'asyncWithin',
      shapeClass: 'SvgBubble'
    })
  }

  setData (layoutNode) {
    this.layoutNode = layoutNode
    this.drawType = this.getDrawType(layoutNode)

    this.asyncBetweenLines.setData(layoutNode)
    if (this.drawType !== 'squash') {
//      this.asyncWithinLines.setData(layoutNode)
      this.syncBubbles.setData(layoutNode)
    }

    if (this.d3NodeGroup) this.setCoordinates()
    return this
  }

  setCoordinates () {
    this.strokePadding = this.ui.settings.labelMinimumSpace // this.ui.settings.strokePadding
    this.labelMinimumSpace = this.ui.settings.labelMinimumSpace
    this.lineWidth = this.ui.settings.lineWidth

    this.circleCentre = {
      x: this.layoutNode.position.x,
      y: this.layoutNode.position.y
    }

    const inboundConnection = this.layoutNode.inboundConnection
    const previousPosition = inboundConnection ? inboundConnection.sourceLayoutNode.position : {
      // Root node position
      x: this.layoutNode.position.x,
      y: this.ui.settings.svgDistanceFromEdge - this.strokePadding - this.lineWidth
    }
    const connectCentresCoords = new LineCoordinates({
      x1: previousPosition.x,
      y1: previousPosition.y,
      x2: this.layoutNode.position.x,
      y2: this.layoutNode.position.y
    })

    this.degrees = connectCentresCoords.degrees

    // Prevent on-line or following-line label text being upside-down
    this.labelDegrees = labelRotation(this.degrees)
    this.flipLabel = !(this.degrees === this.labelDegrees)

    // TODO: check that this doesn't look wrong in cases of drawType = squash but has withinTime
    const sourceRadius = inboundConnection ? this.getRadius(inboundConnection.sourceLayoutNode) + this.strokePadding : 0

    const offsetLength = sourceRadius - this.lineWidth / 2 + this.strokePadding
    const offsetBeforeLine = new LineCoordinates({
        radians: connectCentresCoords.radians,
        length: offsetLength,
        x1: previousPosition.x,
        y1: previousPosition.y
      })

    this.originPoint = {
      x: offsetBeforeLine.x2,
      y: offsetBeforeLine.y2
    }
  }

  initializeFromData (d3NodeGroup) {
    this.d3NodeGroup = d3NodeGroup
    const partyClass = `party-${this.layoutNode.node.mark.get('party')}`

    this.d3OuterPath = this.d3NodeGroup.append('path')
      .classed('outer-path', true)

    this.asyncBetweenLines.initializeFromData()
    if (this.drawType !== 'squash') {
      this.syncBubbles.initializeFromData()
    }

    this.d3NameLabel = this.d3NodeGroup.append('text')
      .classed(partyClass, true)
      .classed('text-label', true)
      .classed('name-label', true)

    this.d3TimeLabel = this.d3NodeGroup.append('text')
      .classed(partyClass, true)
      .classed('text-label', true)
      .classed('time-label', true)

    this.setCoordinates()
    return this
  }

  draw () {
    if (this.layoutNode.node.constructor.name === 'ShortcutNode') {
      this.drawShortcut()
    } else {
      this.drawOuterPath()
      this.drawNameLabel()

      if (this.drawType === 'labelInCircle') this.drawTimeLabel()

      this.asyncBetweenLines.draw()
      if (this.drawType !== 'squash') {
        this.syncBubbles.draw()
      }
    }
  }

  drawShortcut () {
    this.d3NodeGroup.classed('shortcut', true)

    const backwards = !this.layoutNode.parent
    const degrees = backwards ? LineCoordinates.enforceDegreesRange(this.degrees - 180) : this.degrees
    const length = this.ui.settings.shortcutLength

    let outerPath = ''

    const arrowLine = new LineCoordinates({
      x1: this.originPoint.x,
      y1: this.originPoint.y,
      degrees: this.degrees,
      length
    })

    const start = {
      x: backwards ? arrowLine.x2 : arrowLine.x1,
      y: backwards ? arrowLine.y2 : arrowLine.y1
    }

    const end = {
      x: backwards ? arrowLine.x1 : arrowLine.x2,
      y: backwards ? arrowLine.y1 : arrowLine.y2
    }

    const toArrowLeftBase = new LineCoordinates({
      x1: start.x,
      y1: start.y,
      length: this.strokePadding,
      degrees: degrees - 90
    })
    outerPath += `M ${toArrowLeftBase.x2} ${toArrowLeftBase.y2} `

    const toArrowRightBase = new LineCoordinates({
      x1: toArrowLeftBase.x2,
      y1: toArrowLeftBase.y2,
      length: this.strokePadding * 2,
      degrees: degrees + 90
    })
    outerPath += `L ${toArrowRightBase.x2} ${toArrowRightBase.y2} `

    const toArrowheadRightBase = new LineCoordinates({
      x1: toArrowRightBase.x2,
      y1: toArrowRightBase.y2,
      length: length - this.strokePadding * 2,
      degrees
    })
    outerPath += `L ${toArrowheadRightBase.x2} ${toArrowheadRightBase.y2} `

    const toArrowheadRightCorner = new LineCoordinates({
      x1: toArrowheadRightBase.x2,
      y1: toArrowheadRightBase.y2,
      length: this.strokePadding,
      degrees: degrees + 90
    })
    outerPath += `L ${toArrowheadRightCorner.x2} ${toArrowheadRightCorner.y2} `

    const toArrowheadTip = new LineCoordinates({
      x1: toArrowheadRightBase.x2,
      y1: toArrowheadRightBase.y2,
      x2: end.x,
      y2: end.y,
    })
    outerPath += `L ${toArrowheadTip.x2} ${toArrowheadTip.y2} `

    const toArrowheadLeftCorner = new LineCoordinates({
      x1: toArrowheadRightCorner.x2,
      y1: toArrowheadRightCorner.y2,
      length: this.strokePadding * 4,
      degrees: degrees - 90
    })
    outerPath += `L ${toArrowheadLeftCorner.x2} ${toArrowheadLeftCorner.y2} `

    const toArrowheadLeftBase = new LineCoordinates({
      x1: toArrowheadLeftCorner.x2,
      y1: toArrowheadLeftCorner.y2,
      length: this.strokePadding,
      degrees: degrees + 90
    })
    outerPath += `L ${toArrowheadLeftBase.x2} ${toArrowheadLeftBase.y2} Z`

    this.d3OuterPath.attr('d', outerPath)

    const toArrowMidpoint = new LineCoordinates({
      x1: start.x,
      y1: start.y,
      degrees,
      length: length / 2
    })

    this.d3TimeLabel.classed('hidden', true)
    this.d3NameLabel.text(formatNameLabel(this.layoutNode.node.name))
      .classed(`party-${this.layoutNode.node.mark.get('party')}`, true)
      .classed('on-line-label', true)
    trimText(this.d3NameLabel, length - this.strokePadding)

    const transformString = `translate(${toArrowMidpoint.x2}, ${toArrowMidpoint.y2}) rotate(${this.labelDegrees})`
    this.d3NameLabel.attr('transform', transformString)
  }

  drawNameLabel () {
    this.d3TimeLabel.classed('hidden', true)

    const nameLabel = formatNameLabel(this.layoutNode.node.name)
    const labelPlusTime = `${nameLabel}–${formatTimeLabel(this.layoutNode.node.stats.overall)}`
    this.d3NameLabel.text(labelPlusTime)

    let textAfterTrim = ''
    const spaceInCircle = Math.max(this.getRadius() * 2 - this.strokePadding - this.lineWidth, 0)
    const spaceOnLine = Math.max(this.getLength() - this.strokePadding, 0)

    if (!this.layoutNode.children.length) {
      // Is a leaf / endpoint - can position at end of line, continuing line

      // First see if the label fits fine on the line or in the circle
      if (this.drawType === 'labelOnLine') textAfterTrim = trimText(this.d3NameLabel, spaceOnLine)
      if (this.drawType === 'labelInCircle') textAfterTrim = trimText(this.d3NameLabel, spaceInCircle)

      if (textAfterTrim !== labelPlusTime) {
        // See if putting the label after the line truncates it less
        this.d3NameLabel.text(labelPlusTime)

        const toEndpoint = new LineCoordinates({
          x1: this.circleCentre.x,
          y1: this.circleCentre.y,
          length: this.getRadius() + this.lineWidth + this.strokePadding,
          degrees: this.degrees
        })

        const {
          x2,
          y2
        } = toEndpoint

        const lengthToSide = this.parentContent.getLengthToSide(x2, y2, this.degrees, this.ui.settings)
        const lengthToBottom = this.parentContent.getLengthToBottom(x2, y2, this.degrees, this.ui.settings)
        const lengthToEdge = Math.min(lengthToSide, lengthToBottom)

        const textAfterTrimToEdge = trimText(this.d3NameLabel, lengthToEdge)

        if (textAfterTrimToEdge.length > textAfterTrim.length) {
          this.d3NameLabel.classed('flipped-label', this.flipLabel)
          this.d3NameLabel.classed('endpoint-label', true)
          this.d3NameLabel.classed('upper-label', false)
          this.d3NameLabel.classed('smaller-label', this.drawType === 'squash')

          const transformString = `translate(${x2}, ${y2}) rotate(${this.labelDegrees})`
          this.d3NameLabel.attr('transform', transformString)

          this.d3TimeLabel.classed('hidden', true)

          // Tell the line drawing logic that the expected on-label line has been moved
          if (this.drawType === 'labelOnLine') this.drawType = 'labelAfterLine'
          return
        } else {
          this.d3NameLabel.text(textAfterTrim)
        }

        this.d3NameLabel.classed('hidden', !textAfterTrim)
      }
    }

    if (this.drawType === 'noNameLabel') {
      this.d3NameLabel.classed('hidden', true)
      return
    }

    // Is not a leaf / endpoint - position on line or circle
    this.d3NameLabel.classed('upper-label', true)
    this.d3NameLabel.classed('endpoint-label', false)
    this.d3NameLabel.classed('smaller-label', false)
    this.d3NameLabel.classed('flipped-label', false)

    if (this.drawType === 'labelOnLine') {
      if (!textAfterTrim) textAfterTrim = trimText(this.d3NameLabel, spaceOnLine)

      if (!textAfterTrim) {
        this.drawType = 'noNameLabel'
        this.d3NameLabel.classed('hidden', true)
        return
      }
      this.d3NameLabel.classed('hidden', false)

      const toMidwayPoint = new LineCoordinates({
        x1: this.originPoint.x,
        y1: this.originPoint.y,
        length: this.getLength() / 2,
        degrees: this.degrees
      })
      const transformString = `translate(${toMidwayPoint.x2}, ${toMidwayPoint.y2}) rotate(${this.labelDegrees})`
      this.d3NameLabel.attr('transform', transformString)

      this.d3NameLabel.classed('on-line-label', true)
    } else {
      this.d3NameLabel.classed('on-line-label', false)
    }

    if (this.drawType === 'labelInCircle') {
      if (!textAfterTrim) textAfterTrim = trimText(this.d3NameLabel, spaceInCircle)

      if (!textAfterTrim) {
        this.drawType = 'noNameLabel'
        this.d3NameLabel.classed('hidden', true)
        return
      }
      this.d3NameLabel.classed('hidden', false)

      this.d3NameLabel.attr('transform', `translate(${this.circleCentre.x}, ${this.circleCentre.y}) rotate(${labelRotation(this.degrees - 90)})`)

      this.d3NameLabel.classed('in-circle-label', true)
    } else {
      this.d3NameLabel.classed('in-circle-label', false)
    }
  }

  drawTimeLabel () {
    this.d3TimeLabel.classed('hidden', false)
    this.d3TimeLabel.text(formatTimeLabel(this.layoutNode.node.stats.overall))

    if (!this.layoutNode.children.length || this.drawType === 'noNameLabel' || this.drawType === 'labelOnLine') {
      // Position on line
      const textAfterTrim = trimText(this.d3TimeLabel, this.getLength() - this.strokePadding)
      this.d3TimeLabel.classed('hidden', !textAfterTrim)

      const toMidwayPoint = new LineCoordinates({
        x1: this.originPoint.x,
        y1: this.originPoint.y,
        length: this.getLength() / 2,
        degrees: this.degrees
      })
      const transformString = `translate(${toMidwayPoint.x2}, ${toMidwayPoint.y2}) rotate(${labelRotation(this.degrees)})`
      this.d3TimeLabel.attr('transform', transformString)

      this.d3TimeLabel.classed('on-line-label', true)
      this.d3TimeLabel.classed('in-circle-label', false)

      // If this isn't an endpoint and there's a visible name label, drop below it; else vertically centre
      this.d3TimeLabel.classed('lower-label', this.layoutNode.children.length && !this.d3NameLabel.classed('hidden'))
      return
    } else {
      // Position in circle
      const textAfterTrim = trimText(this.d3TimeLabel, this.getRadius() * 1.5 - this.strokePadding)
      this.d3TimeLabel.classed('hidden', !textAfterTrim)
      this.d3TimeLabel.attr('transform', `translate(${this.circleCentre.x}, ${this.circleCentre.y}) rotate(${labelRotation(this.degrees - 90)})`)

      this.d3TimeLabel.classed('in-circle-label', true)
      this.d3TimeLabel.classed('on-line-label', false)
      this.d3TimeLabel.classed('lower-label', true)
    }
  }

  drawOuterPath () {
    let outerPath = ''
    const lineLength = this.getLength()

    const toLineTopLeft = new LineCoordinates({
      x1: this.originPoint.x,
      y1: this.originPoint.y,
      length: this.strokePadding,
      degrees: this.degrees - 90
    })
    outerPath += `M ${toLineTopLeft.x2} ${toLineTopLeft.y2} `

    const toLineTopRight = new LineCoordinates({
      x1: toLineTopLeft.x2,
      y1: toLineTopLeft.y2,
      length: this.strokePadding * 2,
      degrees: this.degrees + 90
    })
    const toQCurveControlPoint = new LineCoordinates({
      x1: this.originPoint.x,
      y1: this.originPoint.y,
      length: this.strokePadding,
      degrees: this.degrees - 180
    })
    outerPath += `Q ${toQCurveControlPoint.x2} ${toQCurveControlPoint.y2} ${toLineTopRight.x2} ${toLineTopRight.y2}`

    const toLineBottomRight = new LineCoordinates({
      x1: toLineTopRight.x2,
      y1: toLineTopRight.y2,
      length: lineLength,
      degrees: this.degrees
    })

    outerPath += `L ${toLineBottomRight.x2} ${toLineBottomRight.y2} `

    if (this.drawType === 'squash') {
      // End with pointed arrow tip

      const toPointedTip = new LineCoordinates({
        x1: this.originPoint.x,
        y1: this.originPoint.y,
        length: lineLength + this.strokePadding,
        degrees: this.degrees
      })

      outerPath += `L ${toPointedTip.x2} ${toPointedTip.y2} `

      outerPath += 'L' // Ready for simple line to bottom left x y
    } else {
      // End with long-route circular arc around bubble, to bottom left x y

      const arcRadius = this.getRadius() + this.lineWidth * 2
      // Arc definition: A radiusX radiusY x-axis-rotation large-arc-flag sweep-flag x y
      outerPath += `A ${arcRadius} ${arcRadius} 0 1 0`
    }

    const toLineBottomLeft = new LineCoordinates({
      x1: toLineBottomRight.x2,
      y1: toLineBottomRight.y2,
      length: this.strokePadding * 2,
      degrees: this.degrees - 90
    })

    outerPath += ` ${toLineBottomLeft.x2} ${toLineBottomLeft.y2} Z`

    this.d3OuterPath.attr('d', outerPath)
  }

  getRadius (layoutNode = this.layoutNode) {
    if (layoutNode === this.layoutNode && this.drawType === 'squash') {
      return 0
    } else {
      return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
    }
  }

  getLength (layoutNode = this.layoutNode) {
    if (this.drawType === 'squash') {
      return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime() + layoutNode.getWithinTime())
    } else {
      return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime())
    }
  }

  getDrawType (layoutNode) {
    const circleRadius = this.getRadius()
    const lineLength = this.getLength()

    // Too small to discriminate node elements; show a very short line
    if (circleRadius + lineLength < 2) return 'squash'

    // Prefer putting labels on lines over in circles if both are viable and similar
    if (lineLength > 30 && lineLength > circleRadius) return 'labelOnLine'

    if (circleRadius > 30) return 'labelInCircle'

    return 'noNameLabel'
  }
}

function labelRotation (degrees) {
  // Prevent text from being displayed upside down
  if (degrees > 90) return degrees -= 180
  if (degrees < -90) return degrees += 180
  return degrees
}

function trimText (d3Text, maxLength, reps = 0) {
  d3Text.classed('hidden', false)

  const width = d3Text.node().getBBox().width
  const textString = d3Text.text()

  if (width > maxLength) {
    const decimal = maxLength / width
    const trimToLength = Math.floor(textString.length * decimal) - 2

    if (trimToLength > 1 && reps < 5) {
      reps++ // Limit recursion in case unusual characters e.g. diacritics cause infinite loop
      const ellipsisChar = '…'
      const newText = textString.slice(0, trimToLength) + ellipsisChar
      d3Text.text(newText)
      // Check new text fits - won't if early chars are wider than later chars, e.g. 'Mmmmmm!!!!!!'
      return (trimText(d3Text, maxLength, reps))
    }
    d3Text.text('')
    return ''
  }
  return textString
}

function formatTimeLabel (num) {
  // format as 2 significant figures, with ms or s units
  const hairSpace = ' ' // &hairsp; unicode char, SVG doesn't like it as a HTML entity
  if (num < 1) return `<1${hairSpace}ms`

  if (num > 1000) {
    return `${parseFloat((num / 1000).toPrecision(2))}${hairSpace}s`
  } else {
    return `${parseFloat(num.toPrecision(2))}${hairSpace}ms`
  }
}

function formatNameLabel (string) {
  // Remove line numbers from aggregateNode names
  string = string.replace(/\:\d+\:\d+/g, '')

  // Remove indicators of truncated module lists
  string = string.replace(/\.\.\. > /g, '')
  return string
}

module.exports = SvgNodeDiagram
