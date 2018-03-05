'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')

const sock = process.platform === 'win32'
  ? '\\\\.\\pipe\\test-server\\' + path.resolve(__dirname, '..')
  : path.resolve(__dirname, '../test-server.sock')

let connections = 0
const server = http.createServer(function request (req, res) {
  fs.readFile(__filename, function read (err, content) {
    if (err) throw err
    res.end(content)

    if (++connections === 2) {
      server.close()
    }
  })
})

server.listen(sock)
