'use strict'

const util = require('util')
const path = require('path')

class Frame {
  constructor (frame) {
    this.functionName = frame.functionName || ''
    this.typeName = frame.typeName || ''
    this.isEval = frame.isEval || false
    this.isConstructor = frame.isConstructor || false
    this.isNative = frame.isNative || false
    this.isToplevel = frame.isToplevel || false
    this.evalOrigin = frame.evalOrigin || ''
    this.fileName = frame.fileName || ''
    this.lineNumber = frame.lineNumber || 0
    this.columnNumber = frame.columnNumber || 0
  }

  toJSON () {
    const json = {}
    if (this.functionName) json.functionName = this.functionName
    if (this.typeName) json.typeName = this.typeName
    if (this.isEval) json.isEval = this.isEval
    if (this.isConstructor) json.isConstructor = this.isConstructor
    if (this.isNative) json.isNative = this.isNative
    if (this.isToplevel) json.isToplevel = this.isToplevel
    if (this.evalOrigin) json.evalOrigin = this.evalOrigin
    if (this.fileName) json.fileName = this.fileName
    if (this.lineNumber) json.lineNumber = this.lineNumber
    if (this.columnNumber) json.columnNumber = this.columnNumber

    return json
  }

  isNodecore (systemInfo) {
    const fileName = this.fileName
    // evals and natives are not in nodecore
    if (this.isEval || this.isNative) return false

    if (fileName.startsWith('node:') || fileName.startsWith(`internal${systemInfo.pathSeparator}`)) {
      return true
    }

    return !fileName.includes(systemInfo.pathSeparator)
  }

  getFileNameWithoutModuleDirectory (systemInfo) {
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
    // Properly evals are from an external module.
    // NOTE: Consider parseing evalOrigin
    if (this.isEval) return true
    // Properly natives are from external modules too.
    if (this.isNative) return true

    // If the remaining path contains node_modules it is external
    return this.getFileNameWithoutModuleDirectory(systemInfo)
      .split(systemInfo.pathSeparator)
      .includes('node_modules')
  }

  anonymise (systemInfo) {
    if (this.isNodecore(systemInfo) || !this.fileName || this.fileName[0] === '.') return
    const { relative } = (systemInfo.pathSeparator === '/' ? path.posix : path.win32)
    const rel = relative(systemInfo.mainDirectory, this.fileName)
    if (!rel || rel[0] === '.') this.fileName = rel
    else this.fileName = '.' + systemInfo.pathSeparator + rel
  }

  getModuleName (systemInfo) {
    let filePath = this.fileName.split(systemInfo.pathSeparator)
    // For eval frames, use the source file listed in the `evalOrigin`
    if (this.fileName === '' && this.isEval) {
      const m = this.evalOrigin.match(/\((.*?):\d+:\d+\)$/)
      if (m) {
        filePath = m[1].split(systemInfo.pathSeparator)
      }
    }
    if (!filePath.includes('node_modules')) {
      return null
    }

    // Find the last node_modules directory, and count how many were
    // encountered.
    let depth = 0
    let pathIndex = 0
    while (true) {
      const searchIndex = filePath.indexOf('node_modules', pathIndex)
      if (searchIndex === -1) break
      pathIndex = searchIndex + 1
      depth += 1
    }

    if (filePath[pathIndex][0] === '@') pathIndex += 1

    return {
      depth: depth,
      name: filePath[pathIndex]
    }
  }

  getPosition () {
    return `${this.fileName}:${this.lineNumber}:${this.columnNumber}` +
            (this.isEval ? ` [${this.evalOrigin}]` : '')
  }

  format () {
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
      formatted += ' [' + this.evalOrigin + ']'
    } else {
      formatted += ' ' + this.fileName
      formatted += ':' + (this.lineNumber > 0 ? this.lineNumber : '')
      formatted += (this.columnNumber > 0 ? ':' + this.columnNumber : '')
    }

    return formatted
  }

  [util.inspect.custom] (depth, options) {
    if (depth < 0) {
      return `<${options.stylize('Frame', 'special')}>`
    }

    return `<${options.stylize('Frame', 'special')}` +
           ` ${options.stylize(this.format(), 'string')}>`
  }
}

class Frames {
  constructor (frames) {
    this.frames = frames.map((frame) => new Frame(frame))
  }

  formatPositionOnly () {
    return this.frames
      .map((frame) => frame.getPosition())
      .join('\n')
  }

  [util.inspect.custom] (depth, options) {
    const nestedOptions = Object.assign({}, options, {
      depth: depth === null ? null : depth - 1
    })

    if (depth === null) depth = Infinity

    if (depth < 0) {
      return `<${options.stylize('Frames', 'special')}>`
    }

    if (this.frames.length === 0) {
      return `<${options.stylize('Frames', 'special')} []>`
    }

    const nestedFormat = this.map((frame) => util.inspect(frame, nestedOptions))

    const padding = ' '.repeat(9)
    let inner
    if (depth < 1) {
      inner = nestedFormat.join(', ')
    } else {
      inner = `\n${padding}` + nestedFormat.join(`,\n${padding}`)
    }

    return `<${options.stylize('Frames', 'special')} [${inner}]>`
  }

  toJSON () {
    return this.frames.map((frame) => frame.toJSON())
  }

  get length () {
    return this.frames.length
  }

  map (fn, self) {
    return this.frames.map(fn, self)
  }

  forEach (fn, self) {
    return this.frames.forEach(fn, self)
  }

  filter (fn, self) {
    return new Frames(this.frames.filter(fn, self))
  }

  every (fn, self) {
    return this.frames.every(fn, self)
  }

  some (fn, self) {
    return this.frames.some(fn, self)
  }

  first () {
    return this.frames[0]
  }

  last () {
    return this.frames[this.frames.length - 1]
  }

  get (index) {
    if (index >= 0 && index < this.frames.length) {
      return this.frames[index]
    }

    throw new RangeError(
      `index ${index} is out of range in frames array of length ${this.length}`
    )
  }
}

module.exports = Frames
