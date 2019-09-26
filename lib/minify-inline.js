'use strict'

const terser = require('terser')
const fs = require('fs')

module.exports = minifyInline

// Accepts an html file and minifies the first script tag it finds.
// It tries to find the inlined bubbleprof data also (data.json)
// and before doing the minification process it replaces the data
// with a tmp placeholder. This massively reduces the memory overhead
// and likewise increases the perf by many magnitudes.

function minifyInline (filename, opts, cb) {
  fs.readFile(filename, 'utf-8', function (err, data) {
    /* istanbul ignore if: safety assertion, if this fails we have a bug */
    if (err) return cb(err)

    const start = data.indexOf('<script>')
    const end = data.lastIndexOf('</script>')

    /* istanbul ignore if: safety assertion, if this fails we have a bug */
    if (start === -1 || end === -1) return cb(new Error('Must contain <script> and </script> tags'))

    const src = data.slice(start + 8, end) // + 8 === <script>.length
    const magicPrefix = 'module.exports={"data":['
    const magic = '"__MAGIC_MINIFY_STRING_THAT_SHOULD_BE_REPLACED__"'
    const open = data.slice(0, start + 8)
    const close = data.slice(end)

    const i = src.indexOf(magicPrefix)
    const j = src.indexOf('],"httpRequests":', i)
    const magicSrc = i !== -1 && j !== -1
      ? src.slice(0, i) + magicPrefix + magic + src.slice(j)
      : src

    data = null // try to help gc as the data might be +100mbs ...

    const minified = terser.minify(magicSrc, opts)
    /* istanbul ignore if: safety assertion, if this fails we have a bug */
    if (minified.error) return cb(minified.error)
    const code = minified.code.replace(magic, src.slice(i + magicPrefix.length, j))

    fs.writeFile(filename, open + code + close, cb)
  })
}
