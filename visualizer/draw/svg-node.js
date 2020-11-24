'use strict'

const LineCoordinates = require('../layout/line-coordinates.js')
const SvgNodeSection = require('./svg-node-section.js')

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
      shapeClass: 'SvgLine'
    })
    this.syncBubbles = new SvgNodeSection(this, {
      dataPosition: 'within',
      shapeClass: 'SvgBubble'
    })
  }

  setData (layoutNode) {
    this.layoutNode = layoutNode
    this.drawType = this.getDrawType(layoutNode)

    this.asyncBetweenLines.setData(layoutNode)
    this.syncBubbles.setData(layoutNode)

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
    const previousPosition = inboundConnection
      ? inboundConnection.originLayoutNode.position
      : {
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

    const sourceRadius = inboundConnection ? this.getRadius(inboundConnection.originLayoutNode) + this.strokePadding : 0

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
    this.syncBubbles.initializeFromData()

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

  deselect () {
    this.d3OuterPath.classed('selected-node', false)
  }

  select () {
    this.parentContent.deselectAll()
    this.d3OuterPath.classed('selected-node', true)
  }

  animate (svgNodeAnimations, isExpanding) {
    this.setCoordinates()

    this.asyncBetweenLines.animate(svgNodeAnimations, isExpanding)
    this.syncBubbles.animate(svgNodeAnimations, isExpanding)
  }

  draw () {
    if (this.layoutNode.node.constructor.name === 'ShortcutNode') {
      this.drawShortcut()
    } else {
      this.drawOuterPath()
      this.drawNameLabel()
      this.drawTimeLabel()

      this.asyncBetweenLines.draw()
      this.syncBubbles.draw()
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
      y2: end.y
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
    if (!window.CSS.supports('dominant-baseline', 'middle')) {
      this.d3NameLabel.attr('dy', 3)
    }
  }

  drawNameLabel () {
    // Set default class states so recalculations on redraw are always in default condition
    this.d3NameLabel.classed('hidden', false)
    this.d3NameLabel.classed('upper-label', true)
    this.d3NameLabel.classed('endpoint-label', false)
    this.d3NameLabel.classed('flipped-label', false)
    this.d3NameLabel.classed('smaller-label', false)
    this.d3NameLabel.classed('on-line-label', false)
    this.d3NameLabel.classed('in-circle-label', false)
    if (!window.CSS.supports('dominant-baseline', 'middle')) {
      this.d3NameLabel.attr('dy', 0)
    }

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

        const lengthToSide = this.parentContent.getHorizontalLength(x2, y2, this.degrees)
        const lengthToBottom = this.parentContent.getVerticalLength(x2, y2, this.degrees)
        const lengthToEdge = Math.min(lengthToSide, lengthToBottom)

        const textAfterTrimToEdge = trimText(this.d3NameLabel, lengthToEdge)

        if (textAfterTrimToEdge.length > textAfterTrim.length) {
          this.d3NameLabel.classed('upper-label', false)
          this.d3NameLabel.classed('endpoint-label', true)
          this.d3NameLabel.classed('flipped-label', this.flipLabel)
          this.d3NameLabel.classed('smaller-label', this.drawType === 'tiny')
          if (!window.CSS.supports('dominant-baseline', 'middle')) {
            this.d3NameLabel.attr('dy', 3)
          }

          const transformString = `translate(${x2}, ${y2}) rotate(${this.labelDegrees})`
          this.d3NameLabel.attr('transform', transformString)

          this.d3TimeLabel.classed('hidden', true)

          // Tell the rest of the drawing logic that the expected on-line/in-cirlce label has been moved
          if (this.drawType === 'labelOnLine' || this.drawType === 'labelInCircle') this.drawType = 'labelAfterLine'
          return
        } else {
          this.d3NameLabel.text(textAfterTrim)
        }

        this.d3NameLabel.classed('hidden', !textAfterTrim)
      }
    } else if (this.drawType === 'noNameLabel' || this.drawType === 'tiny') {
      this.d3NameLabel.classed('hidden', true)
      return
    }

    // If not returned yet, has space and is not a leaf/endpoint, so position on line or circle

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
      return
    }

    if (this.drawType === 'labelInCircle') {
      // Don't include time label in text label, drop it below
      this.d3TimeLabel.classed('hidden', false)
      this.d3NameLabel.text(nameLabel)

      textAfterTrim = trimText(this.d3NameLabel, spaceInCircle)

      if (!textAfterTrim) {
        this.drawType = 'noNameLabel'
        this.d3NameLabel.classed('hidden', true)
        return
      }
      this.d3NameLabel.classed('hidden', false)

      this.d3NameLabel.attr('transform', `translate(${this.circleCentre.x}, ${this.circleCentre.y}) rotate(${labelRotation(this.degrees - 90)})`)

      this.d3NameLabel.classed('in-circle-label', true)
    }
  }

  drawTimeLabel () {
    if (this.drawType !== 'labelInCircle') {
      this.d3TimeLabel.classed('hidden', true)
      return
    }

    this.d3TimeLabel.classed('hidden', false)
    this.d3TimeLabel.text(formatTimeLabel(this.layoutNode.node.stats.overall))

    // Position in circle
    const textAfterTrim = trimText(this.d3TimeLabel, this.getRadius() * 1.5 - this.strokePadding)
    this.d3TimeLabel.classed('hidden', !textAfterTrim)
    this.d3TimeLabel.attr('transform', `translate(${this.circleCentre.x}, ${this.circleCentre.y}) rotate(${labelRotation(this.degrees - 90)})`)

    this.d3TimeLabel.classed('in-circle-label', true)
    this.d3TimeLabel.classed('on-line-label', false)
    this.d3TimeLabel.classed('lower-label', true)
    if (!window.CSS.supports('dominant-baseline', 'text-before-edge')) {
      this.d3TimeLabel.attr('dy', 11)
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

    // End with long-route circular arc around bubble, to bottom left x y
    const arcRadius = this.getRadius() + this.lineWidth * 2
    const toLineBottomLeft = new LineCoordinates({
      x1: toLineBottomRight.x2,
      y1: toLineBottomRight.y2,
      length: this.strokePadding * 2,
      degrees: this.degrees - 90
    })
    // Arc definition: A radiusX radiusY x-axis-rotation large-arc-flag sweep-flag x y
    outerPath += `A ${arcRadius} ${arcRadius} 0 1 0 ${toLineBottomLeft.x2} ${toLineBottomLeft.y2} Z`

    this.d3OuterPath.attr('d', outerPath)
  }

  getRadius (layoutNode = this.layoutNode) {
    return this.ui.layout.scale.getCircleRadius(layoutNode.getWithinTime())
  }

  getLength (layoutNode = this.layoutNode) {
    return this.ui.layout.scale.getLineLength(layoutNode.getBetweenTime())
  }

  getDrawType (layoutNode) {
    const circleRadius = this.getRadius()
    const lineLength = this.getLength()

    // Smaller end-of-line labels for very small nodes
    if (circleRadius + lineLength < 2) return 'tiny'

    // Prefer putting labels on lines over in circles if both are viable and similar
    if (lineLength > 30 && lineLength > circleRadius) return 'labelOnLine'

    if (circleRadius > 30) return 'labelInCircle'

    return 'noNameLabel'
  }
}

function labelRotation (degrees) {
  // Prevent text from being displayed upside down
  if (degrees > 90) return (degrees -= 180)
  if (degrees < -90) return (degrees += 180)
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
  string = string.replace(/:\d+:\d+/g, '')

  // Remove indicators of truncated module lists
  string = string.replace(/\.\.\. > /g, '')
  return string
}

module.exports = SvgNode
