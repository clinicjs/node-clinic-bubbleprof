'use strict'

const fs = require('fs')
const path = require('path')
const express = require('express')
const xsock = require('cross-platform-sock')

const sock = xsock(path.join(__dirname, '../test-server.sock'))
const app = express()

try {
  fs.unlinkSync(sock)
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('could not unlink test-server.sock:', err.stack)
  }
}
const server = app.listen(sock)

let connections = 0
app.use(express.urlencoded({ extended: true }))
app.get('/', function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})
