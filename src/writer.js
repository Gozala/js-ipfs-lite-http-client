"use strict"

class DirectoryEntryWriter {
  /**
   *
   * @param {DirectoryWriter|null} parent
   * @param {string} name
   */
  constructor(parent, name) {
    this.parent = parent
    this.name = name
  }
  get path() {
    let path = this.name
    let { parent } = this
    while (parent) {
      path = `${parent.name}/${path}`
      parent = parent.parent
    }

    Object.defineProperty(this, "path", { value: path })

    return path
  }
}

const emptyBlob = new Blob([])

export class FileWriter extends DirectoryEntryWriter {
  /**
   *
   * @param {DirectoryWriter} parent
   * @param {string} name
   * @param {Blob} [content]
   * @param {FileWriterOptions} [options]
   * @typedef {Object} FileWriterOptions
   * @property {Mode} [mode]
   * @property {Time} [lastModified]
   * @property {string} [hashAlgorithm]
   * @property {boolean} [rawLeaves]
   * @property {boolean} [trickle]
   * @property {string} [chunker]
   * @property {0|1} [cidVersion]
   */
  constructor(parent, name, content = emptyBlob, options = {}) {
    super(parent, name)
    /** @type {Blob} */
    this.content = content
    this.options = options

    this.result = new Promise((resolve, reject) => {
      this.succeed = resolve
      this.fail = reject
    })
  }
  /** @type {FileType} */
  get fileType() {
    return "file"
  }

  /**
   * @param {WriteContent} content
   * @param {WriteOptions} [options]
   * @typedef {Object} WriteOptions
   * @property {number} [offset]
   * @property {boolean} [rawLeaves]
   * @property {boolean} [truncate]
   * @property {0|1} [cidVersion]
   * @property {Mode} [mode]
   * @property {Time} [lastModified]
   */
  write(content, options = {}) {
    const { truncate, offset } = options
    if (truncate) {
      this.content = emptyBlob
    }

    const blob = this.content

    if (offset > blob.size) {
      throw new RangeError("provided offset is out of bounds")
    } else if (offset === blob.size) {
      this.content =
        blob.size === 0 ? new Blob([content]) : new Blob([blob, content])
    } else {
      const length = content instanceof Blob ? content.size : content.byteLength

      const parts = []
      if (offset > 0) {
        parts.push(this.content.slice(0, offset))
      }

      parts.push(content)

      if (blob.size > offset + length) {
        parts.push(blob.slice(offset + length))
      }

      this.content = new Blob(parts)
    }
  }
  /**
   *
   * @param {number} start
   * @param {number} [end]
   * @param {string} [type]
   */
  slice(start, end = this.size, type = this.type) {
    return this.content.slice(start, end, type)
  }

  get type() {
    return this.content.type
  }
  get size() {
    return this.content.size
  }

  /**
   * @param {Object} [options]
   */
  stat(options) {
    return this.result
  }
}

/**
 * @typedef {string|number} Mode
 * @typedef {Blob|ArrayBufferView|ArrayBuffer} WriteContent
 * @typedef {number|Date} Time
 * @typedef {'file'|'directory'} FileType
 */

/**
 * @typedef {DirectoryWriter|FileWriter} EntryWriter
 */

export class DirectoryWriter extends DirectoryEntryWriter {
  /**
   * @param {DirectoryWriter|null} parent
   * @param {string} name
   * @param {DirectoryWriterOptions} [options]
   * @param {Record<string, EntryWriter>} [entries]
   * @typedef {Object} DirectoryWriterOptions
   * @property {boolean} [parents]
   * @property {string} [hashAlg]
   * @property {Mode} [mode]
   * @property {Time} [lastModified]
   */
  constructor(parent, name, options = {}, entries = Object.create(null)) {
    super(parent, name)
    this.options = options
    this.entries = entries
  }
  /** @type {FileType} */
  get fileType() {
    return "directory"
  }
  /**
   * @param {string} name
   * @param {DirectoryWriterOptions} [options]
   */
  createDirectory(name, options) {
    const { entries } = this
    const entry = entries[name]
    if (entry == null) {
      const directory = new DirectoryWriter(this, name, options)
      entries[name] = directory
      return directory
    } else {
      throw new ExistingEntryError({ parent: this, name })
    }
  }

  /**
   * @param {string} name
   * @param {Object} [options]
   * @param {DirectoryWriterOptions|boolean} [options.create]
   * @returns {DirectoryWriter}
   */
  getDirectory(name, options = {}) {
    const entry = this.entries[name]
    if (entry == null) {
      if (options.create) {
        const create = options.create === true ? undefined : options.create
        const directory = new DirectoryWriter(this, name, create)
        this.entries[name] = directory
        return directory
      } else {
        throw new NotFound({
          parent: this,
          entryName: name,
          entryType: "directory",
        })
      }
    } else if (entry instanceof DirectoryWriter) {
      return entry
    } else {
      throw new InvalidEntryError({
        parent: this,
        name,
        expected: "directory",
        actual: "file",
      })
    }
  }

  /**
   * @param {string} name
   * @param {Object} [options]
   * @param {FileWriterOptions|boolean} [options.create]
   * @returns {FileWriter}
   */
  getFile(name, options = {}) {
    const entry = this.entries[name]
    if (entry == null) {
      if (options.create) {
        const create = options.create === true ? undefined : options.create
        const file = new FileWriter(this, name, undefined, create)
        this.entries[name] = file
        return file
      } else {
        throw new NotFound({
          parent: this,
          entryName: name,
          entryType: "file",
        })
      }
    } else if (entry instanceof FileWriter) {
      return entry
    } else {
      throw new InvalidEntryError({
        parent: this,
        name,
        expected: "file",
        actual: "directory",
      })
    }
  }
}

const splitPath = (path = "") => {
  // split on / unless escaped with \
  return (path.trim().match(/([^\\^/]|\\\/)+/g) || []).filter(Boolean)
}

export class FileSystemWriter {
  constructor() {
    this.directory = new DirectoryWriter(null, "")
  }
  /**
   * @param {DirectoryWriter} directory
   * @param {string} path
   * @param {Object} [options]
   * @param {DirectoryWriterOptions|boolean} [options.create]
   * @returns {[DirectoryWriter, string]}
   */
  static resolve(directory, path, options = {}) {
    const pathNames = splitPath(path)
    const targetName = pathNames.pop()
    if (targetName == null) {
      throw new InvalidPath(path)
    }

    for (const name in pathNames) {
      directory = directory.getDirectory(name, options)
    }

    return [directory, targetName]
  }
  /**
   * @param {string} path
   * @param {Object} [options]
   * @param {boolean} [options.parents]
   * @param {string} [options.hashAlg]
   * @param {boolean} [options.flush]
   * @param {Mode} [options.mode]
   * @param {Time} [options.lastModified]
   * @returns {DirectoryWriter}
   */
  createDirectory(path, options = {}) {
    const [directory, name] = FileSystemWriter.resolve(
      this.directory,
      path,
      options.parents ? { create: options } : { create: false }
    )

    return directory.createDirectory(name, options)
  }
  /**
   * @param {string} path
   * @param {Blob|ArrayBufferView|ArrayBuffer} content
   * @param {FileWriteOptions} options
   * @typedef {Object} FileWriteOptions
   * @property {boolean} [create]
   * @property {boolean} [truncate]
   * @property {boolean} [parents]
   * @property {number} [length]
   * @property {boolean} [rawLeaves]
   * @property {0|1} [cidVersion]
   * @property {Mode} [mode]
   * @property {Time} [lastModified]
   */
  writeFile(path, content, options) {
    const [directory, name] = FileSystemWriter.resolve(
      this.directory,
      path,
      options.parents ? { create: options } : { create: false }
    )

    return directory.getFile(name, options).write(content, options)
  }

  /**
   *
   * @param {string} path
   * @param {Object} options
   */
  async stat(path, options) {
    const [directory, name] = FileSystemWriter.resolve(this.directory, path, {
      create: false,
    })
    return directory.getFile(name).stat(options)
  }

  /**
   * @param {DirectoryWriter} directory
   * @returns {Iterable<DirectoryWriter|FileWriter>}
   */
  static *iterate(directory) {
    for (const entry of Object.values(directory.entries)) {
      yield entry
      if (entry instanceof DirectoryWriter) {
        yield* this.iterate(entry)
      }
    }
  }
  async flush() {
    const parts = []
    let index = 0
    const boundery = `-----FileSystemWriterBoundery${Math.random()
      .toString(32)
      .slice(2)}`

    for (const entry of FileSystemWriter.iterate(this.directory)) {
      const { mode, lastModified } = entry.options
      const [name, type, content] =
        entry instanceof DirectoryWriter
          ? ["dir", "application/x-directory", null]
          : ["file", entry.type, entry.content]

      const id = index > 0 ? `${name}-${index}` : name
      const path = encodeURIComponent(entry.path)

      if (index > 0) {
        parts.push("\r\n")
      }

      parts.push(`--${boundery}\r\n`)
      parts.push(
        `Content-Disposition: form-data; name="${id}"; filename="${path}"\r\n`
      )
      parts.push(`Content-Type: application/x-directory\r\n`)

      if (mode != null) {
        parts.push(`mode: ${serializeMode(mode)}\r\n`)
      }

      if (lastModified != null) {
        const [secs, nsecs] = parseTime(entry.options.lastModified)
        parts.push(`mtime: ${secs}\r\n`)
        parts.push(`mtime-nsecs: ${nsecs}\r\n`)
      }

      if (content != null) {
        parts.push("\r\n")
        parts.push(content)
      }

      index++
    }

    parts.push(`\r\n--${boundery}--\r\n`)

    const body = new Blob(parts)
  }
}

export class FileSystemError extends Error {
  constructor() {
    super("")
  }
  description() {
    return "FileSystemError"
  }
  get message() {
    return this.description()
  }
}

export class NotFound extends FileSystemError {
  /**
   * @param {Object} options
   * @param {DirectoryWriter} options.parent
   * @param {FileType} options.entryType
   * @param {string} options.entryName
   */
  constructor({ parent, entryType, entryName }) {
    super()
    this.parent = parent
    this.entryType = entryType
    this.entryName = entryName
  }
  description() {
    const { parent, entryType, entryName } = this
    return `Diretory ${parent.path} does not contain ${entryType} named "${entryName}"`
  }
}

export class InvalidEntryError extends FileSystemError {
  /**
   * @param {Object} options
   * @param {DirectoryWriter} options.parent
   * @param {string} options.name
   * @param {FileType} options.expected
   * @param {FileType} options.actual
   */
  constructor({ parent, name, expected, actual }) {
    super()
    this.parent = parent
    this.name = name
    this.expected = expected
    this.actual = actual
  }
  description() {
    const { parent, name, expected, actual } = this
    return `Diretory ${parent.path} does not contain ${expected} named "${name}, it contains ${actual} instead"`
  }
}

export class ExistingEntryError extends FileSystemError {
  /**
   * @param {Object} options
   * @param {DirectoryEntryWriter} options.parent
   * @param {string} options.name
   */
  constructor(options) {
    super()
    this.parent = options.parent
    this.name = options.name
  }
  description() {
    return `Directory ${this.parent.path} already contains entry named ${this.name}`
  }
}
export class InvalidPath extends FileSystemError {
  /**
   * @param {string} path
   */
  constructor(path) {
    super()
    this.path = path
  }
  description() {
    return `Path "${this.path}" is not valid`
  }
}

/**
 * @param {Mode} mode
 * @returns {string}
 */
const serializeMode = (mode) => {
  if (typeof mode === "number") {
    return mode.toString(8).padStart(4, "0")
  } else {
    return mode
  }
}

/**
 * @param {Time} time
 * @returns {[number, number]}
 */
const parseTime = (time) => {
  const ms = time instanceof Date ? time.getTime() : new Date(time).getTime()
  const secs = Math.floor(ms / 1000)
  const nsecs = (ms - secs * 1000) * 1000
  return [secs, nsecs]
}

export default FileSystemWriter
