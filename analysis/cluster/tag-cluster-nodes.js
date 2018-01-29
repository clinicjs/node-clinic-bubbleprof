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

    const types = nodes.map(node => node.type)
    const parent = this._clusters.get(data.parentClusterId)

    if (types.includes('PIPESERVERWRAP')) {
      data.tags.push('server', 'unix-socket')
    }
    if (types.includes('TCPSERVERWRAP')) {
      data.tags.push('server', 'tcp')
    }
    if (types.includes('HTTPPARSER')) {
      data.tags.push('http')
      // TODO: maybe needs to propagate to ancestors also?
      if (parent.tags.includes('server') || parent.tags.includes('connection')) {
        parent.tags.push('http')
      }
    }
    if (types.includes('PIPEWRAP')) {
      data.tags.push('connection', 'unix-socket')
      if (parent.tags.includes('http')) {
        data.tags.push('http')
      }
    }
    if (types.includes('TCPCONNECTWRAP')) {
      data.tags.push('connection', 'tcp')
      if (parent.tags.includes('http')) {
        data.tags.push('http')
      }
    }

    cb()
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
  return node.type && node.type !== 'Timeout' && node.type !== 'TickObject'
}
