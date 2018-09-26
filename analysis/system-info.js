'use strict'

class SystemInfo {
  constructor (data) {
    this.providers = new Set(data.providers)
    this.mainDirectory = data.mainDirectory

    // Backwards compatibility with data collected in Bubbleprof <1.6.1, which contained a typo
    this.pathSeparator = data.pathSeparator || data.pathSeperator

    // Compute self-module directory for the special case that the main script
    // itself is in a node_modules directory.
    const mainDirectoryPath = this.mainDirectory
      .split(this.pathSeparator)
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
        .join(this.pathSeparator)
    } else {
      this.moduleDirectory = ''
    }
  }
}

module.exports = SystemInfo
