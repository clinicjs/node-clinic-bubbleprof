'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')

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

server.listen(path.resolve(__dirname, '..', '.server.sock'))
