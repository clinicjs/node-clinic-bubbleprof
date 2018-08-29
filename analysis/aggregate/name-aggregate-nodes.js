const { Transform } = require('stream')

class Name extends Transform {
  constructor (sysInfo) {
    super({ writableObjectMode: true, readableObjectMode: true })
    this.systemInfo = sysInfo
  }

  _transform (data, enc, cb) {
    const name = getAggregateName(data, this.systemInfo)
    data.name = name
    cb(null, data)
  }
}

module.exports = Name

function getAggregateName (aggregateNode, sysInfo) {
  const frames = aggregateNode.frames.filter(frame => frame.fileName)
  const interesting = toArray(frames.filter(frame => name(frame)))

  const userland = interesting.filter(isUserland(sysInfo))
  if (userland.length) return name(userland[0])

  const modules = interesting.map(toModule(sysInfo)).filter(mod => mod)
  if (modules.length) return modules[0]

  return null
}

function toArray (frames) {
  // map converts the frame list into an actual array
  return frames.map(x => x)
}

function toModule (sysInfo) {
  return function (frame) {
    const mod = frame.getModuleName(sysInfo)
    if (mod) return name(frame) + '@' + mod.name
  }
}

function name (frame) {
  return frame.functionName || frame.typeName
}

function isUserland (sysInfo) {
  return frame => !frame.isExternal(sysInfo) && !frame.isNodecore(sysInfo)
}
