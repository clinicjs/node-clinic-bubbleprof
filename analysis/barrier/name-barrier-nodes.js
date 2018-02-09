const stream = require('stream')

class NameBarrierNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo

    this._aggregateNodes = new Map()
    this._types = new Map()
    this._needsChildren = new Set()
    this._queued = []
  }

  _blocked (barrierNode) {
    if (!this._needsChildren.size) return false

    const self = this

    return barrierNode.children
      .map(id => self._aggregateNodes.get(id))
      .some(blocked)

    function blocked (aggregateNode) {
      if (!aggregateNode) return true
      return aggregateNode.children
        .map(id => self._aggregateNodes.get(id))
        .some(blocked)
    }
  }

  _drainQueue () {
    while (this._queued.length && !this._blocked(this._queued[0])) {
      if (this._needsChildren.size) {
        for (const aggregateNode of this._queued[0].nodes) {
          this._needsChildren.delete(aggregateNode)
        }
      }
      this._nameNode(this._queued.shift())
    }
  }

  _transform (barrierNode, enc, cb) {
    for (const aggregateNode of barrierNode.nodes) {
      this._aggregateNodes.set(aggregateNode.aggregateId, aggregateNode)

      const types = groupType(aggregateNode)

      if (types.includes('server') || types.includes('connection') || types.includes('root')) {
        // if root, we need a child to try and name it. also wait for children to see if we can
        // detect if this is a http server/connection
        this._needsChildren.add(aggregateNode)
      }
    }

    this._drainQueue()

    if (this._queued.length || this._blocked(barrierNode)) {
      this._queued.push(barrierNode)
      return cb()
    }

    this._nameNode(barrierNode)
    cb()
  }

  _getTypes (node) {
    if (!node) return []
    const types = this._types.get(node)
    return types || groupType(node)
  }

  _setTypes (node, types) {
    this._types.set(node, types)
  }

  _pushType (node, types, type) {
    types.push(type)
    this._setTypes(node, types)
  }

  _getChild (node, filterTypes) {
    if (!node) return null

    for (const id of node.children) {
      const child = this._aggregateNodes.get(id)
      if (!child) continue

      const childTypes = this._getTypes(child)
      if (filterTypes.every(type => childTypes.includes(type))) {
        return child
      }
    }

    return null
  }

  _getAncestor (node, filterTypes) {
    let parent = this._aggregateNodes.get(node.parentAggregateId)
    while (parent) {
      const parentTypes = this._getTypes(parent)
      if (filterTypes.every(type => parentTypes.includes(type))) {
        return parent
      }
      parent = this._aggregateNodes.get(parent.parentAggregateId)
    }
  }

  _swapRootWithChild (aggregateNode) {
    // swap root types for the first child, otherwise the root is type less
    if (aggregateNode.type || !aggregateNode.children.length) return aggregateNode
    return this._aggregateNodes.get(aggregateNode.children[0])
  }

  _updateTypes (aggregateNode) {
    const types = this._getTypes(aggregateNode)

    // if server see if there is an immedidate child with created connection
    // and see if that child has a http parser. if so we are an http server
    if (types.includes('server')) {
      const connection = this._getChild(aggregateNode, ['connection', 'create'])
      const http = this._getChild(connection, ['http'])

      if (http) this._pushType(aggregateNode, types, 'http')
      return types
    }

    // if a connection is created, see if an immediate child is a http parser
    // and tag us as http as well if so.
    if (types.includes('connection') && types.includes('create')) {
      const http = this._getChild(aggregateNode, ['http'])

      if (http) this._pushType(aggregateNode, types, 'http')
      return types
    }

    // any connection operation, find the creation ancestor node and see if that
    // is a http connecion. if so, so are we.
    if (types.includes('connection')) {
      const create = this._getAncestor(aggregateNode, ['connection', 'create'])
      const createTypes = this._getTypes(create)

      if (createTypes.includes('http')) this._pushType(aggregateNode, types, 'http')
      return types
    }

    return types
  }

  _nameAggregateNode (aggregateNode) {
    aggregateNode = this._swapRootWithChild(aggregateNode)

    const moduleName = getModuleName(aggregateNode, this.systemInfo)
    const typeName = toName(this._updateTypes(aggregateNode))

    const name = []
    if (moduleName) name.push('module', moduleName)
    if (typeName) name.push(typeName)

    return name.join('.')
  }

  _nameNode (barrierNode) {
    if (barrierNode.isWrapper && !barrierNode.isRoot) {
      this.push(barrierNode)
      return
    }

    const names = barrierNode.nodes
      .map(node => this._nameAggregateNode(node))
      .filter(noDups())
      .filter(val => val) // no falsy values

    // maximum 4 parts ...
    if (names.length > 4) barrierNode.name = names.slice(0, 4).join(' + ') + '...'
    else barrierNode.name = names.join(' + ')

    this.push(barrierNode)
  }
}

module.exports = NameBarrierNodes

function noDups () {
  const seen = new Set()
  return function (val) {
    if (seen.has(val)) return false
    seen.add(val)
    return true
  }
}

function getModuleName (aggregateNode, sysInfo) {
  const frames = aggregateNode.frames.filter(frame => frame.fileName)

  if (isExternal(frames, sysInfo)) {
    const firstModule = aggregateNode.frames
      .filter((frame) => !frame.isNodecore(sysInfo))
      .map((frame) => frame.getModuleName(sysInfo).name)
      .pop()

    if (firstModule) return firstModule
  }

  return null
}

function isExternal (frames, sysInfo) {
  return frames.every(frame => frame.isExternal(sysInfo))
}

function groupType (node) {
  if (!node.type) return ['root']
  switch (node.type) {
    case 'SHUTDOWNWRAP':
      return ['connection', 'end']
    case 'WRITEWRAP':
      return ['connection', 'write']
    case 'TickObject':
      return ['nextTick']
    case 'Immediate':
      return ['setImmediate']
    case 'Timeout':
      return ['timeout']
    case 'TCPWRAP':
    case 'PIPEWRAP':
      return ['connection', 'create']
    case 'TCPCONNECTWRAP':
    case 'PIPECONNECTWRAP':
      return ['connection', 'connect', 'create']
    case 'HTTPPARSER':
      return ['http']
    case 'TCPSERVERWRAP':
    case 'PIPESERVERWRAP':
      return ['server']
    case 'FSREQWRAP':
      return ['fs']
    default:
      return []
  }
}

function toName (types) {
  if (types.includes('server')) {
    return types.includes('http') ? 'http.server' : 'server'
  }

  if (types.includes('connection')) {
    let name = 'connection'
    if (types.includes('http')) name = 'http.' + name
    if (types.includes('write')) return name + '.write'
    if (types.includes('end')) return name + '.end'
    if (types.includes('connect')) return name + '.connect'
    return name
  }

  if (types.includes('fs')) return 'fs'
  if (types.includes('nextTick')) return 'nextTick'
  if (types.includes('setImmediate')) return 'setImmediate'
  if (types.includes('timeout')) return 'timeout'

  return ''
}
