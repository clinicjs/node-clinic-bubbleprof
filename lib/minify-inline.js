const terser = require('terser')
const fs = require('fs')

module.exports = minifyInline

function minifyInline (filename, opts, cb) {
  fs.readFile(filename, 'utf-8', function (err, data) {
    if (err) return cb(err)

    const start = data.indexOf('<script>')
    const end = data.lastIndexOf('</script>')

    if (start === -1 || end === -1) return cb(new Error('Must contain <script> and </script> tags'))

    const src = data.slice(start + 8, end) // + 8 === <script>.length
    const magicPrefix = 'module.exports={"data":['
    const magic = '"__MAGIC_MINIFY_UNIQUE_STRING_TO_BE_REPLACED__"'
    const open = data.slice(0, start + 8)
    const close = data.slice(end)

    const i = src.indexOf(magicPrefix)
    const j = src.indexOf('],"httpRequests":', i)
    const magicSrc = i !== -1 && j !== -1
      ? src.slice(0, i) + magicPrefix + magic + src.slice(j)
      : src

    data = null // try to help gc as the data might be +100mbs ...

    const minified = terser.minify(magicSrc, opts)
    if (minified.error) return cb(minified.error)
    const code = minified.code.replace(magic, src.slice(i + magicPrefix.length, j))

    fs.writeFile(filename, open + code + close, cb)
  })
}
