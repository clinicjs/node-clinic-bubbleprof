const express = require('express')

const app = express()
const server = app.listen(18353)

let connections = 0
app.use(express.urlencoded({ extended: true }))
app.get('/', function (req, res) {
  res.end('almost empty')
  if (++connections === 2) {
    server.close()
  }
})
