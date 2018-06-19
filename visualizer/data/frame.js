'use strict'

class Frame {
  constructor (frame) {
    this.functionName = frame.functionName
    this.typeName = frame.typeName
    this.evalOrigin = frame.evalOrigin
    this.fileName = frame.fileName
    this.lineNumber = frame.lineNumber
    this.columnNumber = frame.columnNumber
    this.isEval = frame.isEval
    this.isConstructor = frame.isConstructor
    this.isNative = frame.isNative
    this.isToplevel = frame.isToplevel
    this.party = this.getFrameParty(this.fileName)
  }

  getName () {
    let name = this.functionName ? this.functionName : '<anonymous>'
    if (this.isEval) {
      // no change
    } else if (this.isToplevel) {
      // no change
    } else if (this.isConstructor) {
      name = 'new ' + name
    } else if (this.isNative) {
      name = 'native ' + name
    } else {
      name = this.typeName + '.' + name
    }
    return name
  }

  getFormatted (name) {
    let formatted = '    at ' + name
    if (this.isEval) {
      formatted += ' ' + this.evalOrigin
    } else {
      formatted += ' ' + this.fileName
      formatted += ':' + (this.lineNumber > 0 ? this.lineNumber : '')
      formatted += (this.columnNumber > 0 ? ':' + this.columnNumber : '')
    }
    return formatted
  }

  // TODO: move this logic to analysis, add property there, then trim file paths
  getFrameParty (fileName) {
    if (!fileName) return ['empty', 'no file']

    // If first character is / or it's a letter followed by :\
    if (fileName.charAt(0) === '.' || fileName.charAt(0) === '/' || fileName.match(/^[a-zA-Z]:\\/)) {
      // ...then this is a Unix or Windows style local file path

      if (fileName.match(/(?:\\|\/)node_modules(?:\\|\/)/)) {
        const directories = fileName.split(/\\|\//)
        const moduleName = directories[directories.lastIndexOf('node_modules') + 1]
        return ['external', `module ${moduleName}`]
      }
      return ['user', 'your application']
    }
    return ['nodecore', 'node core']
  }
}

module.exports = Frame
