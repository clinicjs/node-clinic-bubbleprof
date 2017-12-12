'use strict'

const util = require('util')

class Frame {
  constructor(frame) {
    this.functionName = frame.functionName
    this.typeName = frame.typeName
    this.isEval = frame.isEval
    this.isConstructor = frame.isConstructor
    this.isNative = frame.isNative
    this.isToplevel = frame.isToplevel
    this.evalOrigin = frame.evalOrigin
    this.fileName = frame.fileName
    this.lineNumber = frame.lineNumber
    this.columnNumber = frame.columnNumber
  }

  isNodecore (systemInfo) {
    const fileName = this.fileName

    if (fileName.startsWith(`internal${systemInfo.pathSeperator}`)) {
      return true
    }

    return !fileName.includes(systemInfo.pathSeperator)
  }

  getFileNameWithoutModuleDirectory(systemInfo) {
    // Cut out the module directory if present. This is to avoid detecting
    // the path as being external, in case the module directory iself contains
    // node_modules.
    const startIndex = this.fileName.indexOf(systemInfo.moduleDirectory)
    let stripedFileName = this.fileName
    if (startIndex >= 0) {
      stripedFileName = this.fileName.slice(
        startIndex + systemInfo.moduleDirectory.length
      )
    }

    return stripedFileName
  }

  isExternal (systemInfo) {
    if (this.isNodecore(systemInfo)) return true

    // If the remaining path contains node_modules it is external
    return this.getFileNameWithoutModuleDirectory(systemInfo)
      .split(systemInfo.pathSeperator)
      .includes('node_modules')
  }

  getModuleName(systemInfo) {
    const filePath = this.fileName.split(systemInfo.pathSeperator)
    if (!filePath.includes('node_modules')) return null

    const depth = filePath.lastIndexOf('node_modules') + 1
    if (!filePath[depth]) return null

    return {
      depth: depth,
      name: filePath[depth]
    }
  }

  getPosition() {
    let position = this.fileName
    if (this.lineNumber > 0) {
      position += ':' + this.lineNumber
    }
    if (this.columnNumber > 0) {
      position += ':' + this.columnNumber
    }

    if (this.isEval) {
      position += ' ' + this.evalOrigin
    }

    return position
  }

  format() {
    // Get name
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

    // Get position
    let formatted = name
    if (this.isEval) {
      formatted += ' ' + this.evalOrigin
    } else {
      formatted += ' ' + this.fileName
      formatted += ':' + (this.lineNumber > 0 ? this.lineNumber : '')
      formatted += (this.columnNumber > 0 ? ':' + this.columnNumber : '')
    }

    return formatted
  }

  [util.inspect.custom] (depth, options) {
    return `<${options.stylize('Frame', 'special')}` +
           ` ${options.stylize(this.format(), 'string')}>`
  }
}

class Frames {
  constructor(frames) {
    this.frames = frames.map((frame) => new Frame(frame))
  }

  [util.inspect.custom] (depth, options) {
    if (depth < 0) {
      return `<${options.stylize('Frames', 'special')}>`;
    }

    const nestedOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1
    });

    const padding = ' '.repeat(9)
    const inner = this.map((frame) => util.inspect(frame, nestedOptions))
      .join(`\n${padding}`)
    return `<${options.stylize('Frames', 'special')} [${inner}]>\n`;
  }

  toJSON() {
    return this.frames
  }

  map(fn, self) {
    return this.frames.map(fn, self)
  }

  forEach(fn, self) {
    return this.frames.forEach(fn, self)
  }

  filter(fn, self) {
    return new Frames(this.frames.filter(fn, self))
  }

  every(fn, self) {
    return this.frames.every(fn, self)
  }

  some(fn, self) {
    return this.frames.every(fn, self)
  }
}

module.exports = Frames
