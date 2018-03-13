'use strict'

const path = require('path')
const http = require('http')
const xsock = require('cross-platform-sock')

const sock = xsock(path.join(__dirname, '../test-server.sock'))

let connections = 0
const server = http.createServer(function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})

server.listen(sock)
