'use strict'

const util = require('util')
const SourceNode = require('../source/source-node.js')

class Mark {
  constructor () {
    this.mark = [null, null, null] /* party, module, name */
  }

  set (index, value) {
    this.mark[index] = value
  }

  get (index) {
    return this.mark[index]
  }

  format () {
    if (this.mark[0] === null) {
      return 'null'
    } else if (this.mark[1] === null) {
      return `${this.mark[0]}`
    } else if (this.mark[2] === null) {
      return `${this.mark[0]}.${this.mark[1]}`
    } else {
      return `${this.mark[0]}.${this.mark[1]}.${this.mark[2]}`
    }
  }

  toJSON () {
    return this.mark
  }

  [util.inspect.custom] (depth, options) {
    if (depth < 0) {
      return `<${options.stylize('Mark', 'special')}>`
    }

    return `<${options.stylize('Mark', 'special')} ${options.stylize(this.format(), 'string')}>`
  }
}

class AggregateNode {
  constructor (aggregateId, parentNodeId) {
    this.aggregateId = aggregateId
    this.parentNodeId = parentNodeId
    this.children = []
    this.sources = []

    this.isRoot = false
    this.mark = new Mark()
    this.type = null
    this.frames = null
  }

  [util.inspect.custom] (depth, options) {
    const nestedOptions = Object.assign({}, options, {
      depth: depth === null ? null : depth - 1
    })
    const framesInspect = util.inspect(this.frames, nestedOptions)
      .split('\n')

    if (depth < 0) {
      return `<${options.stylize('AggregateNode', 'special')}>`
    }

    let inner
    if (depth < 1) {
      inner = framesInspect.join(', ')
    } else {
      inner = framesInspect.slice(0, -1).join('\n  ')
    }

    const childrenFormatted = this.children
      .map((child) => options.stylize(child, 'number'))
      .join(', ')

    return `<${options.stylize('AggregateNode', 'special')}` +
           ` type:${options.stylize(this.type, 'string')},` +
           ` mark:${util.inspect(this.mark, nestedOptions)},` +
           ` aggregateId:${options.stylize(this.aggregateId, 'number')},` +
           ` parentNodeId:${options.stylize(this.parentNodeId, 'number')},` +
           ` sources.length:${options.stylize(this.sources.length, 'number')},` +
           ` children:[${childrenFormatted}],` +
           ` frames:${inner}>`
  }

  toJSON () {
    return {
      aggregateId: this.aggregateId,
      parentNodeId: this.parentNodeId,
      children: this.children,
      mark: this.mark.toJSON(),
      type: this.type,
      frames: this.frames.toJSON(),
      // frames and type are the same for all SourceNode's, so remove them
      // from the SourceNode data.
      sources: this.sources.map((source) => source.toJSON({ short: true }))
    }
  }

  makeRoot () {
    const root = new SourceNode(1)
    root.makeRoot()

    this.addSourceNode(root)
    this.isRoot = true
    this.mark.set(0, 'root')
  }

  addChild (aggregateId) {
    this.children.push(aggregateId)
  }

  getChildren () {
    return this.children
  }

  addSourceNode (sourceNode) {
    if (this.sources.length === 0) {
      this.type = sourceNode.type
      this.frames = sourceNode.frames
    }

    this.sources.push(sourceNode)
  }

  getSourceNodes (sourceNode) {
    return this.sources
  }
}

module.exports = AggregateNode
