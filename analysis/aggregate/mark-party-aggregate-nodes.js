'use strict'
const stream = require('stream')

class MarkPartyAggregateNodes extends stream.Transform {
  constructor (systemInfo) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })

    this.systemInfo = systemInfo

    // Compute self-module directory for the special case that the main script
    // itself is in a node_modules directory.
    const mainDirectoryPath = this.systemInfo.mainDirectory
      .split(this.systemInfo.pathSeperator)
    if (mainDirectoryPath.includes('node_modules')) {
      let mainDirectoryIndex = mainDirectoryPath.lastIndexOf('node_modules')
      // module is in a @namespace
      if (mainDirectoryPath[mainDirectoryIndex + 1][0] === '@') {
        mainDirectoryIndex += 1
      }
      // add the module itself
      mainDirectoryIndex += 1

      // Join up the path, it will look like:
      // "/home/user/node_modules/@private/server"
      this.moduleDirectory = mainDirectoryPath.slice(0, mainDirectoryIndex + 1)
        .join(this.systemInfo.pathSeperator)
    } else {
      this.moduleDirectory = ''
    }
  }

  _isNodecoreFrame (frame) {
    const fileName = frame.fileName

    if (fileName.startsWith(`internal${this.systemInfo.pathSeperator}`)) {
      return true
    }

    return !fileName.includes(this.systemInfo.pathSeperator)
  }

  _isExternal (frame) {
    if (this._isNodecoreFrame(frame)) return true

    // Cut out the module directory if present. This is to avoid detecting
    // the path as being external, in case the module directory iself contains
    // node_modules.
    const startIndex = frame.fileName.indexOf(this.moduleDirectory)
    let stripedFileName = frame.fileName
    if (startIndex >= 0) {
      stripedFileName = frame.fileName.slice(
        startIndex + this.moduleDirectory.length
      )
    }

    // If the remaining path contains node_modules it is external
    return stripedFileName
      .split(this.systemInfo.pathSeperator)
      .includes('node_modules')
  }

  _transform (node, encoding, done) {
    if (node.mark[0] === 'root') {
      return done(null, node)
    }

    const fileFrames = node.frames.filter((frame) => frame.fileName)

    // If there is no stack, the handle is created in C++. Check if
    // it is a nodecore handle.
    if (fileFrames.length === 0 && this.systemInfo.providers.has(node.type)) {
      node.mark[0] = 'nodecore' // second party
      return done(null, node)
    }

    // There is a stack, check if it is purely internal to nodecore.
    if (fileFrames.every(this._isNodecoreFrame, this)) {
      node.mark[0] = 'nodecore' // second party
      return done(null, node)
    }

    // Analyse only users frames
    if (fileFrames.every(this._isExternal, this)) {
      node.mark[0] = 'external' // third party
      return done(null, node)
    }

    // The frame is not nodecore nor external, assume it is relevant to
    // the user.
    node.mark[0] = 'user' // first party
    return done(null, node)
  }
}

module.exports = MarkPartyAggregateNodes
