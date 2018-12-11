'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const xsock = require('cross-platform-sock')

const sock = xsock(path.join(__dirname, '../test-server.sock'))

let connections = 0
const server = http.createServer(function (req, res) {
  setTimeout(function () {
    res.end('almost empty')
  }, 10)
  if (++connections === 2) {
    server.close()
  }
})

try {
  fs.unlinkSync(sock)
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('could not unlink test-server.sock:', err.stack)
  }
}
server.listen(sock)
