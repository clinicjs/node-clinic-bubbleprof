const stream = require('stream')

class Anonymise extends stream.Transform {
  constructor (sysInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = sysInfo
  }

  _transform (data, enc, cb) {
    const sysInfo = this.systemInfo

    for (const node of data.nodes) {
      node.frames.forEach(anonymiseFrame)
    }

    cb(null, data)

    function anonymiseFrame (frame) {
      frame.anonymise(sysInfo)
    }
  }
}

module.exports = Anonymise
