const { Transform } = require('stream')

class Name extends Transform {
  constructor (sysInfo) {
    super({writableObjectMode: true, readableObjectMode: true})
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
  const interesting = frames
    .filter(frame => !frame.isNodecore(sysInfo))
    .filter(frame => frame.functionName)
    .map(x => x)

  const userland = interesting.filter(frame => !frame.isExternal(sysInfo))
  if (userland.length) return userland[0].functionName

  const modules = interesting
    .map(function (frame) {
      const mod = frame.getModuleName(sysInfo)
      if (mod) return frame.functionName + '@' + mod.name
    })
    .filter(mod => mod)

  if (modules.length) return modules[0]
  return null
}
