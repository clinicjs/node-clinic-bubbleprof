'use strict'

const stream = require('stream')

const FRAME_PREFIX_SIZE = 4 // uint32 is 4 bytes
const MAX_CHUNK_SIZE = 10 * 65536

class AbstractDecoder extends stream.Transform {
  constructor (messageType, options) {
    super(Object.assign({
      readableObjectMode: true,
      writableObjectMode: false
    }, options))

    this._messageType = messageType

    this._buffers = []
    this._bufferedLength = 0
    this._nextMessageLength = FRAME_PREFIX_SIZE
    this._awaitFramePrefix = true
    this._warned = false
  }

  _transform (chunk, encoding, callback) {
    // Join buffers if the concated buffer contains an object
    if (this._bufferedLength > 0 &&
        this._bufferedLength + chunk.length >= this._nextMessageLength) {
      chunk = Buffer.concat(this._buffers.concat([chunk]))
      this._buffers = []
      this._bufferedLength = 0
    }

    // decode as long as there is an entire object
    // This is implemented as a very basic state machine:
    while (chunk.length >= this._nextMessageLength) {
      switch (this._awaitFramePrefix) {
        case true:
          this._nextMessageLength = chunk.readUInt32BE(0)
          chunk = chunk.slice(FRAME_PREFIX_SIZE)
          this._awaitFramePrefix = false
          break
        case false:
          try {
            const msg = this._messageType.decode(chunk.slice(0, this._nextMessageLength))
            this.push(
              msg
            )
          } catch (_)
          /* istanbul ignore next: if we knew how to trigger it we wouldn't need the `catch` at all! */
          { // eslint-disable-line brace-style
            // Recover from the 16 bit truncation bug in the encoder
            if (chunk.length < MAX_CHUNK_SIZE) {
              this._nextMessageLength += 65536
              break
            }
            if (!this._warned) {
              console.error('There was a decoding error with chunk (base64):')
              console.error(chunk.toString('base64'))
              console.error('Please open an issue on https://github.com/clinicjs/node-clinic-bubbleprof with the above output.')
              this._warned = true
            }
          }
          chunk = chunk.slice(this._nextMessageLength)
          this._nextMessageLength = FRAME_PREFIX_SIZE
          this._awaitFramePrefix = true
          break
      }
    }

    // add remaining chunk if there is data left
    if (chunk.length > 0) {
      this._buffers.push(chunk)
      this._bufferedLength += chunk.length
    }

    callback(null)
  }
}

module.exports = AbstractDecoder
