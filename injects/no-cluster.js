const cluster = require('cluster')

cluster.on('fork', () => {
  throw new Error('clinic bubbleprof does not support clustering.')
})
