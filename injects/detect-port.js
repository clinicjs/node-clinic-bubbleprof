const onlisten = require('on-net-listen')
const fs = require('fs')
const net = require('net')
const logger = require('./logger')

onlisten(function (addr) {
  // we do async activity below and we do not want that to pollute the
  // analysis. we use the skipThis flag to opt out of collecting stats here.
  logger.skipThis = true
  this.destroy()
  const port = Buffer.from(addr.port + '')
  fs.writeSync(3, port, 0, port.length)
  signal(3, function () {
    process.emit('beforeExit')
  })
  logger.skipThis = false
})

function signal (fd, cb) {
  const s = new net.Socket({ fd, readable: true, writable: false })
  s.unref()
  s.on('error', () => {})
  s.on('close', cb)
}
