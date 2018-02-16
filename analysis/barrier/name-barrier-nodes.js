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
    this._queued = []
  }

  _transform (barrierNode, enc, cb) {
    this._queued.push(barrierNode)
    for (const aggregateNode of barrierNode.nodes) {
      this._aggregateNodes.set(aggregateNode.aggregateId, aggregateNode)
    }
    cb()
  }

  _flush (cb) {
    for (const barrierNode of this._queued) {
      barrierNode.setName(this._getBarrierName(barrierNode))
      this.push(barrierNode)
    }
    cb()
  }

  _getTypes (aggregateNode) {
    let types = this._types.get(aggregateNode)
    if (types) return types
    types = groupType(aggregateNode)
    this._types.set(aggregateNode, types)
    return types
  }

  _getChild (aggregateNode, filterTypes) {
    if (!aggregateNode) return
    for (const id of aggregateNode.children) {
      const child = this._aggregateNodes.get(id)
      const childTypes = this._getTypes(child)
      if (filterTypes.every(type => childTypes.includes(type))) {
        return child
      }
    }
  }

  _getAncestor (aggregateNode, filterTypes) {
    let parent = this._aggregateNodes.get(aggregateNode.parentAggregateId)
    while (parent) {
      const parentTypes = this._getTypes(parent)
      if (filterTypes.every(type => parentTypes.includes(type))) {
        return parent
      }
      parent = this._aggregateNodes.get(parent.parentAggregateId)
    }
  }

  _getParent (aggregateNode, filterTypes) {
    const parent = this._aggregateNodes.get(aggregateNode.parentAggregateId)
    const parentTypes = this._getTypes(parent)
    if (filterTypes.every(type => parentTypes.includes(type))) {
      return parent
    }
  }

  _swapRootWithChild (aggregateNode) {
    // swap root types for the first child that is a server, otherwise the root is type less
    if (!aggregateNode.isRoot) return aggregateNode

    for (const child of aggregateNode.children) {
      const childNode = this._aggregateNodes.get(child)
      if (this._getTypes(childNode).includes('server')) return childNode
    }

    return aggregateNode
  }

  _updateTypes (aggregateNode) {
    const types = this._getTypes(aggregateNode)

    // if server see if there is an immedidate child with created connection
    // and see if that child has a http parser. if so we are an http server
    if (types.includes('server')) {
      const http = this._getChild(aggregateNode, ['http'])
      const connection = this._getChild(aggregateNode, ['connection', 'create'])
      const httpConnection = this._getChild(connection, ['http'])

      if (http || httpConnection) types.push('http')
      return types
    }

    // if a connection is created, see if an immediate child is a http parser
    // and tag us as http as well if so.
    if (types.includes('connection') && types.includes('create')) {
      const http = this._getChild(aggregateNode, ['http'])
      const httpServer = !types.includes('connect') &&
        this._getParent(aggregateNode, ['http', 'server'])

      if (http || httpServer) types.push('http')
      return types
    }

    // any connection operation, find the creation ancestor node and see if that
    // is a http connecion. if so, so are we.
    if (types.includes('connection')) {
      const create = this._getAncestor(aggregateNode, ['connection', 'create'])
      const createTypes = create ? this._getTypes(create) : []
      if (createTypes.includes('http')) types.push('http')
      return types
    }

    return types
  }

  _nameAggregateNode (aggregateNode) {
    aggregateNode = this._swapRootWithChild(aggregateNode)

    const types = this._updateTypes(aggregateNode)
    const moduleName = getModuleName(aggregateNode, this.systemInfo)
    const typeName = toName(types)
    const name = []

    if (moduleName) name.push('module', moduleName)
    if (typeName) name.push(typeName)

    return name.join('.')
  }

  _getBarrierName (barrierNode) {
    const names = barrierNode.nodes
      .map(aggregateNode => this._nameAggregateNode(aggregateNode))
      .filter(noDups())
      .filter(val => val) // no falsy values

    // maximum 4 parts ...
    if (!names.length) return 'miscellaneous'
    if (names.length <= 4) return names.join(' + ')
    return names.slice(0, 4).join(' + ') + ' + ...'
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
    case 'PROMISE':
      return ['promise']
    case 'RANDOMBYTESREQUEST':
      return ['random-bytes']
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

  if (types.includes('http')) return 'http'
  if (types.includes('fs')) return 'fs'
  if (types.includes('nextTick')) return 'nextTick'
  if (types.includes('setImmediate')) return 'setImmediate'
  if (types.includes('timeout')) return 'timeout'
  if (types.includes('promise')) return 'promise'
  if (types.includes('random-bytes')) return 'random-bytes'

  return ''
}
