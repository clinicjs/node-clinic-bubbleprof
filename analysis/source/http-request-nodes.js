const { Transform } = require('stream')

function isHTTPEnd (sourceNode) {
  if (sourceNode.type !== 'TickObject') return false
  for (let i = 0; i < sourceNode.frames.length; i++) {
    const frame = sourceNode.frames.get(i)
    if (frame.typeName !== 'ServerResponse') continue
    if (frame.functionName !== 'end') continue
    return true
  }
  return false
}

function upsert (nodes, id) {
  const list = nodes.get(id) || []
  if (!list.length) nodes.set(id, list)
  return list
}

class HTTPRequestNodes extends Transform {
  constructor (analysis) {
    super({ readableObjectMode: true, writableObjectMode: true })
    this._nodes = new Map()
    this._minTime = 0
    this._maxTime = 0
    this._analysis = analysis
  }

  _transform (data, enc, cb) {
    if (!this._minTime || data.init < this._minTime) {
      this._minTime = data.init
    }
    if (!this._maxTime || data.init > this._maxTime) {
      this._maxTime = data.init
    }

    if (isHTTPEnd(data)) {
      const id = data.identifier
      upsert(this._nodes, id).push(data.asyncId)
    }

    cb(null, data)
  }

  _maxRequests () {
    let result = []
    for (const nodes of this._nodes.values()) {
      if (nodes.length > result.length) result = nodes
    }
    return result
  }

  _flush (cb) {
    this._analysis.runtime = this._maxTime - this._minTime
    this._analysis.httpRequests = this._maxRequests()
    cb(null)
  }
}

module.exports = HTTPRequestNodes
