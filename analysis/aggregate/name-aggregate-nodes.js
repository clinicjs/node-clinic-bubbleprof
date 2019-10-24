const { Transform } = require('stream')
const path = require('path')

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

  // here is a list of observed generic identifiers where the lcoation should be better described, either by another
  // frame in the node, or by the filename - this can be added to
  const tooGeneric = [
    'module.exports',
    'handler',
    'async.series',
    'async.parallel',
    'Promise.all.then',
    'Promise.all',
    'Object'
  ]
  if (userland.length) {
    const uniqueNameOptions = [...new Set(userland.map(frame => name(frame)))]
    let nameCandidate = uniqueNameOptions.reduce((prev, curr) => !tooGeneric.includes(curr) ? curr : prev, null)

    if (!nameCandidate) {
      const sysPath = sysInfo.pathSeparator.includes('\\') ? path.win32 : path
      const filePath = userland[0].getFileNameWithoutModuleDirectory(sysInfo)
      nameCandidate = sysPath.basename(filePath)
      // we don't want a default name - let's take the containing dirname
      if (nameCandidate === 'index.js') {
        nameCandidate = sysPath.dirname(filePath).split(sysInfo.pathSeparator).pop()
      }
    }
    return nameCandidate
  }

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
