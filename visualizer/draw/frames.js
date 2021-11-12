'use strict'
const closeIcon = require('@clinic/clinic-common/icons/close')

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')
const arrayFlatten = require('array-flatten').flatten

class Frames extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    this.framesByNode = []
    this.topmostUI = null

    this.firstDraw = true

    this.ui.on('setTopmostUI', (topmostUI) => {
      this.topmostUI = topmostUI
    })
  }

  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('frames-container', true)

    this.d3Heading = this.d3ContentWrapper.append('div')
      .classed('heading', true)

    this.ui.on('outputFrames', (aggregateNode) => {
      if (aggregateNode) {
        this.setData(aggregateNode)
      } else {
        this.reset()
      }
    })
  }

  reset () {
    this.node = null
    this.framesByNode = []
    this.parentContent.collapseClose()
  }

  setData (aggregateNode) {
    this.node = aggregateNode
    this.isRoot = aggregateNode.isRoot

    this.framesByNode = []
    groupFrames(this.node, this.framesByNode)
    this.parentContent.collapseOpen()
  }

  draw () {
    super.draw()

    if (this.firstDraw) {
      this.firstDraw = false
      this.parentContent.d3ContentWrapper.insert('span', ':first-child')
        .classed('close', true)
        .html(closeIcon)
        .on('click', () => {
          this.topmostUI.clearFrames()
          this.parentContent.collapseClose()
        })
    }

    this.d3ContentWrapper.selectAll('.frame-item').remove()
    this.d3ContentWrapper.selectAll('.frame-group').remove()

    if (this.node) {
      this.drawFrames(this.framesByNode, this.d3ContentWrapper)
      this.d3Heading.html(`Showing async stack trace from async operation "<strong>${this.node.name}</strong>"`)
        .on('mouseover', () => {
          const layoutNode = this.topmostUI.layout.findDataNode(this.node)
          this.topmostUI.highlightNode(layoutNode, this.node)
        })
        .on('mouseout', () => {
          this.topmostUI.highlightNode(null)
        })
    } else {
      this.d3Heading.html(`
        Click on a grouping in the diagram above to drill down, and find the call stacks showing the exact lines of code these async operations originated from.
      `)
      this.d3Heading.on('mouseover', null)
      this.d3Heading.on('mouseout', null)
    }
  }

  getDelaysText (aggregateNode) {
    const betweenFigure = this.ui.formatNumber(aggregateNode.getBetweenTime())
    const withinFigure = this.ui.formatNumber(aggregateNode.getWithinTime())
    return `<span class="figure">${betweenFigure} ms</span> in asynchronous delays, <span class="figure">${withinFigure} ms</span> in synchronous delays.`
  }

  drawFrames (frames, d3AppendTo) {
    if (!frames.length) {
      const d3Group = d3AppendTo.append('div')
        .classed('frame-group', true)
        .on('click', () => {
          d3Group.classed('collapsed', !d3Group.classed('collapsed'))
        })

      d3Group.append('div')
        .classed('sub-collapse-control', true)
        .html('<span class="arrow"></span> Empty frames')

      const d3EmptyFrameItem = d3Group.append('div')
        .classed('frame-item', true)

      if (frames.dataNode && frames.dataNode.isRoot) {
        d3EmptyFrameItem.text('This is the root node, representing the starting point of your application. No stack frames are available.')
      } else {
        d3EmptyFrameItem.text('No frames are available for this async operation. It could be from a native module, or something not integrated with the Async Hooks API.')
      }
    }
    for (const frame of frames) {
      if (frame.isGroup) {
        const d3Group = d3AppendTo.append('div')
          .classed('frame-group', true)

        const d3SubCollapseControl = d3Group.append('div')
          .classed('sub-collapse-control', true)

        let header = '<span class="arrow"></span>'
        if (frame.dataNode) {
          const isThisNode = frame.dataNode === this.node

          d3Group
            .classed('node-frame-group', true)
            .classed('collapsed', !isThisNode)
            .classed('this-node', isThisNode)

          if (!isThisNode) {
            d3Group.insert('a', ':first-child')
              .classed('jump-to-node', true)
              .text('Select on diagram')
              .on('mouseover', () => {
                const layoutNode = this.topmostUI.layout.findDataNode(frame.dataNode) || this.topmostUI.layout.rootLayoutNode
                this.topmostUI.highlightNode(layoutNode, frame.dataNode)
              })
              .on('mouseout', () => {
                this.topmostUI.highlightNode(null)
              })
              .on('click', () => {
                this.topmostUI.queueAnimation('jumpToFrame', (animationQueue) => {
                  const targetUI = this.topmostUI.jumpToNode(frame.dataNode, animationQueue)
                  this.topmostUI.originalUI.emit('navigation', { from: this.ui, to: targetUI })
                })
              })
          }

          header += `${arrayFlatten(frame).length} frames from `
          header += `${isThisNode ? 'this async operation' : `previous async operation "${frame.dataNode.name}"`}`
          header += `<div class="delays">${this.getDelaysText(frame.dataNode)}</span>`
        } else if (frame.party) {
          d3Group.classed(frame.party[0], true)
            .classed('collapsed', frame.party[0] !== 'user')
          header += `${frame.length} frame${frame.length === 1 ? '' : 's'} from ${frame.party[1]}`
        }

        d3SubCollapseControl.html(header)
          .on('click', () => {
            d3Group.classed('collapsed', !d3Group.classed('collapsed'))
          })

        this.drawFrames(frame, d3Group)
      } else {
        d3AppendTo.append('pre')
          .html(frame.formatted)
          .classed('frame-item', true)
      }
    }
  }
}

function groupFrames (aggregateNode, framesByNode) {
  let previousFrame
  let previousGroup
  const groupedFrames = []
  groupedFrames.dataNode = aggregateNode
  groupedFrames.isGroup = true

  for (const frame of aggregateNode.frames) {
    const party = frame.data.party
    if (!previousFrame || previousFrame.data.party[1] !== party[1]) {
      const group = [frame]
      group.isGroup = true
      group.party = party
      groupedFrames.push(group)
      previousGroup = group
    } else {
      previousGroup.push(frame)
    }
    previousFrame = frame
  }

  framesByNode.push(groupedFrames)

  // Full async stack trace - recurse through aggregate ancestry to the root aggregate node
  if (aggregateNode.parentId) groupFrames(aggregateNode.getParentNode(), framesByNode)
}

module.exports = Frames
