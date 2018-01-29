const stream = require('stream')

class TagClusterNodes extends stream.Transform {
  constructor () {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this._clusters = new Map()
    this._queued = []
  }

  _transform (data, enc, cb) {
    // queue all nodes cause we update old ones
    // as an optimisation we can detect when old nodes are no longer
    // updated and start emitting them then
    this._queued.push(data)
    this._clusters.set(data.clusterId, data)

    const nodes = data.nodes.filter(interestingNode)
    if (!nodes.length) {
      this._clusters.set(data.clusterId, this._clusters.get(data.parentClusterId))
      return cb()
    }

    const self = this
    const types = nodes.map(node => node.type)
    const parent = this._clusters.get(data.parentClusterId)

    if (types.includes('PIPESERVERWRAP')) {
      data.tags.push('server', 'unix-socket')
    }
    if (types.includes('TCPSERVERWRAP')) {
      data.tags.push('server', 'tcp')
    }
    if (types.includes('HTTPPARSER')) {
      const serverAncestor = ancestor('server')
      const connectionAncestor = ancestor('connection')
      if (serverAncestor) serverAncestor.tags.unshift('http')
      if (connectionAncestor) connectionAncestor.tags.unshift('http')
      data.tags.push('http', 'connection')
    }
    if (types.includes('SHUTDOWNWRAP')) {
      inherits('http')
      data.tags.push('connection')
      data.tags.push('end')
    }
    if (types.includes('PIPEWRAP')) {
      inherits('http')
      data.tags.push('connection', 'create', 'unix-socket')
    }
    if (types.includes('TCPCONNECTWRAP')) {
      inherits('http')
      data.tags.push('connection', 'create', 'tcp')
    }
    if (types.includes('PIPECONNECTWRAP')) {
      inherits('http')
      data.tags.push('connection', 'create', 'unix-socket')
    }
    if (types.includes('FSREQWRAP')) {
      data.tags.push('fs')
    }
    if (types.includes('WRITEWRAP')) {
      const connectionAncestor = ancestor('connection')
      if (connectionAncestor) {
        if (connectionAncestor.tags.includes('http')) data.tags.push('http')
        data.tags.push('connection')
      }
      data.tags.push('write')
    }

    cb()

    function ancestor (type) {
      var parent = self._clusters.get(data.parentClusterId)

      while (parent) {
        if (parent.tags.includes(type)) {
          return parent
        }
        parent = self._clusters.get(parent.parentClusterId)
      }

      return null
    }

    function inherits (type) {
      if (data.tags.includes(type)) return
      if (ancestor(type)) data.tags.push(type)
    }
  }

  _flush (cb) {
    for (let i = 0; i < this._queued.length; i++) {
      this.push(this._queued[i])
    }
    cb()
  }
}

module.exports = TagClusterNodes

function interestingNode (node) {
  return node.type &&
    node.type !== 'Timeout' &&
    node.type !== 'TickObject' &&
    node.type !== 'Immediate'
}
