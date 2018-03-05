'use strict'

const path = require('path')
const http = require('http')

const sock = process.platform === 'win32'
  ? '\\\\.\\pipe\\test-server\\' + path.resolve(__dirname, '..')
  : path.resolve(__dirname, '../test-server.sock')

let connections = 0
const server = http.createServer(function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})

server.listen(sock)
