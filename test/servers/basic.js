'use strict'

const path = require('path')
const http = require('http')

let connections = 0
const server = http.createServer(function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})

server.listen(path.resolve(__dirname, '..', '.test-server.sock'))
