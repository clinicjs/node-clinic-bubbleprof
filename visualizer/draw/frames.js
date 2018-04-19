'use strict'

// const d3 = require('./d3-subset.js') // Currently unused but will be used
const HtmlContent = require('./html-content.js')

class Frames extends HtmlContent {
  constructor (d3Container, contentProperties = {}) {
    super(d3Container, contentProperties)
    this.frames = null
  }

  groupFrames (frames) {
    let previousFrame
    let previousGroup
    const groupedFrames = []

    for (const frame of frames) {
      if (!previousFrame || previousFrame.data.party[1] !== frame.data.party[1]) {
        const group = [frame]
        group.isGroup = true
        groupedFrames.push(group)
        previousGroup = group
      } else {
        previousGroup.push(frame)
      }
      previousFrame = frame
    }
    this.frames = groupedFrames
  }

  initializeElements () {
    super.initializeElements()

    this.d3Element.classed('frames-container', true)

    this.d3Element.append('span')
      .classed('close', true)
      .on('click', () => {
        const footer = this.ui.sections.get('footer')
        footer.collapseControl.isCollapsed = true
        footer.draw()
      })

    this.d3NoFrames = this.d3ContentWrapper.append('p')
      .text(`
        Click on a bubble or a connection to drill down and find the stack frames of the code it originates from.
      `)
      .classed('no-frames-message', true)

    this.ui.on('outputFrames', (aggregateNode) => {
      console.log(aggregateNode)
      this.frames = aggregateNode.frames || null
      this.node = aggregateNode
      this.groupFrames(this.frames || [])
      if (aggregateNode) {
        const footer = this.ui.sections.get('footer')
        footer.collapseControl.isCollapsed = false
        footer.draw()
      } else {
        this.draw()
      }
    })
  }

  draw () {
    super.draw()
    this.d3ContentWrapper.selectAll('.frame-item').remove()
    this.d3ContentWrapper.selectAll('.frame-group').remove()

    if (this.frames) {
      this.drawFrames(this.frames, this.d3ContentWrapper)
    }
    if (this.node) {
      this.d3NoFrames.text(`
        ${this.ui.formatNumber(this.node.getBetweenTime())} ms in asynchronous delays, ${this.ui.formatNumber(this.node.getWithinTime())} ms in synchronous delays.
      `)
    }
  }

  drawFrames (frames, d3AppendTo) {
    if (!frames.length) {
      const d3Group = this.d3ContentWrapper.append('div')
        .classed('frame-group', true)
        .on('click', () => {
          d3Group.classed('collapsed', !d3Group.classed('collapsed'))
        })

      d3Group.append('div')
        .classed('sub-collapse-control', true)
        .html('<span class="arrow"></span> Empty frames')

      d3Group.append('div')
        .classed('frame-item', true)
        .text('No frames are available for this async_hook. It could be from a native module, or something not integrated with the async_hooks API.')
    }
    for (const frame of frames) {
      if (frame.isGroup) {
        const d3Group = this.d3ContentWrapper.append('div')
          .classed('frame-group', true)
          .classed(frame[0].data.party[0], true)
          .classed('collapsed', frame[0].data.party[0] !== 'user')
          .on('click', () => {
            d3Group.classed('collapsed', !d3Group.classed('collapsed'))
          })

        d3Group.append('div')
          .classed('sub-collapse-control', true)
          .html(`<span class="arrow"></span>${frame.length} frame${frame.length === 1 ? '' : 's'} from ${frame[0].data.party[1]}`)

        this.drawFrames(frame, d3Group)
      } else {
        d3AppendTo.append('pre')
          .html(frame.formatted)
          .classed('frame-item', true)
      }
    }
  }
}

module.exports = Frames
