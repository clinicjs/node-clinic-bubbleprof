#!/usr/bin/env node

const Tool = require('../')

for (const file of process.argv.slice(2).map(trim)) {
  const tool = new Tool({ debug: true })

  tool.visualize(
    file,
    file + '.html',
    function (err) {
      if (err) {
        console.error(file, 'failed (' + err.message + ')')
      } else {
        console.log('Wrote', file + '.html')
      }
    }
  )
}

function trim (file) {
  return file.replace(/\/\\$/, '')
}
