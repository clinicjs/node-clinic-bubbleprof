'use strict'
const stream = require('stream')

class AggregateToDprof extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: false,
      writableObjectMode: true
    })

    this._nodes = []
    this._rootChildren = null
    this._start = Infinity
    this._total = 0
  }

  _offset (time) {
    return (time - this._start) * 1e6
  }

  _transform (node, encoding, callback) {
    if (node.aggregateId === 1) {
      this._rootChildren = node.children
      return callback(null)
    }

    // Calculate aggregated start end end time
    const init = Math.min(...node.sources.map((source) => source.init))
    const destroy = Math.max(...node.sources.map((source) => source.destroy))

    // Update global end and start time
    this._start = Math.min(this._start, init)
    this._total = Math.max(this._total, destroy)

    // Calculate aggregated before and after times
    const before = [].concat(...node.sources.map((source) => source.before))
      .sort((a, b) => a - b)
    const after = [].concat(...node.sources.map((source) => source.after))
      .sort((a, b) => a - b)

    this._nodes.push({
      name: `${node.type} <${node.mark.format()}>`,
      uid: node.aggregateId,
      parent: node.parentAggregateId,
      stack: node.frames.map(function (frame) {
        return {
          description: frame.format(),
          filename: frame.fileName,
          column: frame.columnNumber,
          line: frame.lineNumber
        }
      }),
      init: init,
      before: before,
      after: after,
      destroy: destroy,
      unref: [],
      ref: [],
      initRef: true,
      children: node.children
    })

    callback(null)
  }

  _flush (callback) {
    this.push(JSON.stringify({
      version: '1.0.1', // the version of dprof there generated this JSON file
      total: this._offset(this._total), // execution time in nanoseconds
      root: {
        name: 'root',
        uid: 1,
        parent: null,
        stack: [],
        init: 0,
        before: [0],
        after: [this._offset(this._total)],
        destroy: this._offset(this._total),
        unref: [],
        ref: [],
        initRef: true,
        children: this._rootChildren
      },
      nodes: this._nodes.map(function (node) {
        node.init = this._offset(node.init)
        node.destroy = this._offset(node.destroy ? node.destroy : this._total)
        node.before = node.before.map((time) => this._offset(time))
        node.after = node.after.map((time) => this._offset(time))
        return node
      }, this)
    }, null, 1))

    callback(null)
  }
}

module.exports = AggregateToDprof
