const rimraf = require('rimraf')
const ClinicBubbleprof = require('../index.js')

const bubble = new ClinicBubbleprof({})
bubble.collect([
  process.execPath,
  '-e', 'var c = require("cluster"); c.isMaster && c.fork()'
], (err, result) => {
  rimraf.sync(result)
  if (err) throw err
})
