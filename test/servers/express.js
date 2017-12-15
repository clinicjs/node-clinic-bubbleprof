'use strict'

const path = require('path')
const express = require('express')

const app = express()
const server = app.listen(path.resolve(__dirname, '..', '.test-server.sock'))

let connections = 0
app.use(express.urlencoded({ extended: true }))
app.get('/', function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})
