const path = require('path')
const rimraf = require('rimraf')
const ClinicBubbleprof = require('../index.js')

const bubble = new ClinicBubbleprof({})
bubble.collect([
  process.execPath,
  path.join(__dirname, 'cmd-no-cluster.cluster.js')
], (err, result) => {
  rimraf.sync(result)
  if (err) throw err
})
