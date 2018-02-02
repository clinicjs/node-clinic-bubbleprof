'use strict'

const path = require('path')
const http = require('http')
const simpleHttpServer = require('simple-http-server')

function recursiveSetImmediate (repeats, callback) {
  setImmediate(function () {
    if (repeats > 0) {
      recursiveSetImmediate(repeats - 1, callback)
    } else {
      callback()
    }
  })
}

let connections = 0
const server = simpleHttpServer(function (req, res) {
  connections += 1
  if (connections === 1) {
    recursiveSetImmediate(20, function () {
      res.end('almost empty')
    })
  } else if (connections === 2) {
    recursiveSetImmediate(20, function () {
      res.end('almost empty')
    })
    server.close()
  }
})

server.listen(path.resolve(__dirname, '..', '.test-server.sock'))
