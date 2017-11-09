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

  _transform(node, encoding, callback) {
    if (node.nodeId === 1) {
      this._rootChildren = node.children
      return callback(null)
    }

    const stackTrace = node.sources[0].stackTrace().split('\n')
    const init = Math.min(...node.sources.map((source) => source.init))
    const destroy = Math.max(...node.sources.map((source) => source.destroy))

    this._start = Math.min(this._start, init)
    this._total = Math.max(this._total, destroy)

    this._nodes.push({
      name: node.sources[0].type,
      uid: node.nodeId,
      parent: node.parentNodeId,
      stack: node.sources[0].frames.map(function (frame, index) {
        return  {
          description: stackTrace[index],
          filename: frame.fileName,
          column: frame.columnNumber,
          line: frame.lineNumber
        }
      }),
      init: init,
      before: [],
      after: [],
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
      version: '1.0.1',   // the version of dprof there generated this JSON file
      total: this._total - this._start, // execution time in nanoseconds
      root: {
        name: 'root',
        uid: 1,
        parent: null,
        stack: [],
        init: 0,
        before: [],
        after: [],
        destroy: this._total - this._start,
        unref: [],
        ref: [],
        initRef: true,
        children: this._rootChildren
      },
      nodes: this._nodes.map(function (node) {
        node.init -= this._start
        node.destroy = (node.destroy ? node.destroy : this._total) - this._start
        return node
      }, this)
    }, null, 1))

    callback(null)
  }
}

module.exports = AggregateToDprof
