'use strict'

const http = require('http')
const path = require('path')
const async = require('async')
const fakeDataFetch = require('fake-data-fetch')

let connections = 0
const server = http.createServer(function (req, res) {
  async.parallel({
    db1 (done) { fakeDataFetch('db1', done) },
    db2 (done) { fakeDataFetch('db2', done) }
  }, function (err, result) {
    if (err) throw err
    res.end(JSON.stringify(result))
  })

  if (++connections === 2) {
    server.close()
  }
})

server.listen(path.resolve(__dirname, '..', '.test-server.sock'))
