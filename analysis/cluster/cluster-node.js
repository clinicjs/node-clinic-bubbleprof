'use strict'

const util = require('util')

class ClusterNode {
  constructor (clusterId, parentClusterId) {
    this.clusterId = clusterId
    this.parentClusterId = parentClusterId

    this.isRoot = false
    this.nodes = []
    this.children = []
    this.name = null
  }

  [util.inspect.custom] (depth, options) {
    const nestedOptions = Object.assign({}, options, {
      depth: depth === null ? null : depth - 1
    })
    if (depth === null) depth = Infinity

    if (depth < 0) {
      return `<${options.stylize('ClusterNode', 'special')}>`
    }

    const padding = ' '.repeat(8)
    const nodesFormatted = this.nodes
      .map(function (aggregateNode) {
        return util.inspect(aggregateNode, nestedOptions)
          .split('\n')
          .join('\n' + padding)
      })

    let inner
    if (depth < 1) {
      inner = nodesFormatted.join(', ')
    } else {
      inner = `\n${padding}` + nodesFormatted.join(`,\n${padding}`)
    }

    const childrenFormatted = this.children
      .map((child) => options.stylize(child, 'number'))
      .join(', ')

    return `<${options.stylize('ClusterNode', 'special')}` +
           ` clusterId:${options.stylize(this.clusterId, 'number')},` +
           ` parentClusterId:${options.stylize(this.parentClusterId, 'number')},` +
           ` name:${options.stylize(this.name, 'string')},` +
           ` children:[${childrenFormatted}],` +
           ` nodes:[${inner}]>`
  }

  toJSON () {
    return {
      clusterId: this.clusterId,
      parentClusterId: this.parentClusterId,
      name: this.name,
      children: this.children,
      nodes: this.nodes.map((aggregateNode) => aggregateNode.toJSON())
    }
  }

  makeRoot () {
    this.isRoot = true
  }

  addChild (clusterId) {
    this.children.push(clusterId)
  }

  insertBarrierNode (barrierNode) {
    if ((barrierNode.isRoot || !barrierNode.isWrapper) && !this.name) this.name = barrierNode.name
    this.nodes.push(...barrierNode.nodes)
    this.nodes.sort((a, b) => a.aggregateId - b.aggregateId)
  }
}

module.exports = ClusterNode
