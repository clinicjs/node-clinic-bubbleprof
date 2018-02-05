const stream = require('stream')

class NameBarrierNodes extends stream.Transform {
  constructor(systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo

    this._queued = []
    this._barrierNodes = new Map()
    this._tags = new Map()
    this._root = null
  }

  _transform (data, enc, cb) {
    if (data.isRoot) this._root = data
    this._queued.push(data)
    this._barrierNodes.set(data.barrierId, data)

    const tags = []
    this._tags.set(data, tags)

    // forward the tags explicitly to the root node if child of the root
    // fixes issue where the root does not get named
    if (data.parentBarrierId === 1) {
      this._tags.set(this._root, tags)
    }

    const nodes = data.nodes.filter(interestingNode)
    if (!nodes.length) {
      this._barrierNodes.set(data.barrierId, this._barrierNodes.get(data.parentBarrierId))
      return cb()
    }

    const self = this
    const types = nodes.map(node => node.type)
    const parent = this._barrierNodes.get(data.parentBarrierId)

    if (types.includes('PIPESERVERWRAP')) {
      tags.push('server', 'unix-socket')
    }
    if (types.includes('TCPSERVERWRAP')) {
      tags.push('server', 'tcp')
    }
    if (types.includes('HTTPPARSER')) {
      const serverAncestor = ancestor('server')
      const connectionAncestor = ancestor('connection')
      if (serverAncestor) serverAncestor.unshift('http')
      if (connectionAncestor) connectionAncestor.unshift('http')
      tags.push('http', 'connection')
    }
    if (types.includes('SHUTDOWNWRAP')) {
      inherits('http')
      tags.push('connection')
      tags.push('end')
    }
    if (types.includes('PIPEWRAP')) {
      inherits('http')
      tags.push('connection', 'create', 'unix-socket')
    }
    if (types.includes('TCPCONNECTWRAP')) {
      inherits('http')
      tags.push('connection', 'create', 'tcp')
    }
    if (types.includes('PIPECONNECTWRAP')) {
      inherits('http')
      tags.push('connection', 'create', 'unix-socket')
    }
    if (types.includes('FSREQWRAP')) {
      tags.push('fs')
    }
    if (types.includes('WRITEWRAP')) {
      const connectionAncestor = ancestor('connection')
      if (connectionAncestor) {
        if (connectionAncestor.includes('http')) tags.push('http')
        tags.push('connection')
      }
      tags.push('write')
    }

    cb()

    function ancestor (type) {
      let parent = self._barrierNodes.get(data.parentBarrierId)

      while (parent) {
        const parentTags = self._tags.get(parent)
        if (parentTags.includes(type)) {
          return parentTags
        }
        parent = self._barrierNodes.get(parent.parentBarrierId)
      }

      return null
    }

    function inherits (type) {
      if (tags.includes(type)) return
      if (ancestor(type)) tags.push(type)
    }
  }

  _flush(cb) {
    for (let node of this._queued) {
      this._nameNode(node)
      this.push(node)
    }
    cb()
  }

  _nameNode(barrierNode) {
    if (barrierNode.isWrapper && !barrierNode.isRoot) return

    const aggregateNode = getFirstNode(barrierNode.nodes)
    const frames = aggregateNode.frames.filter(frame => frame.fileName)
    const tags = this._tags.get(barrierNode)
    const isNodecore = frames.every(frame => frame.isNodecore(this.systemInfo))

    // if we have tags, but no frames we still wanna tag this with nodecore + tags
    if (!frames.length && !tags.length) return

    if (isNodecore) {
      // extract more info
      barrierNode.name = 'nodecore' + tags.map(tag => '.' + tag).join('')
      return
    }

    const isExternal = frames.every(frame => frame.isExternal(this.systemInfo))
    if (isExternal) {
      const firstModule = aggregateNode.frames
        .filter((frame) => !frame.isNodecore(this.systemInfo))
        .map((frame) => frame.getModuleName(this.systemInfo))
        .pop()

      barrierNode.name = 'external' + (firstModule ? '.' + firstModule.name : '')
      return
    }

    barrierNode.name = 'user'
  }
}

module.exports = NameBarrierNodes

function getFirstNode (nodes) {
  if (nodes.length === 1) return nodes[0]
  if (nodes[0].type) return nodes[0]
  return nodes[1]
}

function interestingNode (node) {
  return node.type &&
    node.type !== 'Timeout' &&
    node.type !== 'TickObject' &&
    node.type !== 'Immediate'
}
