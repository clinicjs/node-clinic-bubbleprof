'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const async = require('async')
const fakeDataFetch = require('fake-data-fetch')
const xsock = require('cross-platform-sock')

const sock = xsock(path.join(__dirname, '../test-server.sock'))

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

try {
  fs.unlinkSync(sock)
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('could not unlink test-server.sock:', err.stack)
  }
}
server.listen(sock)
