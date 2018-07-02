const { Transform } = require('stream')

function isHTTPEnd (sourceNode) {
  if (sourceNode.type !== 'TickObject') return false
  for (var i = 0; i < sourceNode.frames.length; i++) {
    const frame = sourceNode.frames.get(i)
    if (frame.typeName !== 'ServerResponse') continue
    if (frame.functionName !== 'end') continue
    return true
  }
  return false
}

class RPS extends Transform {
  constructor (analysis) {
    super({readableObjectMode: true, writableObjectMode: true})
    this._hits = new Map()
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
      const prev = this._hits.get(id)
      this._hits.set(id, (prev || 0) + 1)
    }

    cb(null, data)
  }

  _maxRequests () {
    var max = 0
    for (const hits of this._hits.values()) {
      if (hits > max) max = hits
    }
    return max
  }

  _flush (cb) {
    this._analysis.runtime = this._maxTime - this._minTime
    this._analysis.requests = this._maxRequests()
    cb(null)
  }
}

module.exports = RPS
