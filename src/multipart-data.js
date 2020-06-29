import { getFileName } from "./util.js"
export class MultipartData {
  /**
   * @param {Object} [options]
   * @param {string} [options.boundary]
   */
  constructor(options = {}) {
    this.boundary =
      options.boundary ||
      `-----IPFSBlobServiceBoundery${Math.random().toString(32).slice(2)}`

    /** @type {Blob[]} */
    this.parts = []
  }

  /**
   * @param {string} name
   * @param {BlobPart} content
   * @param {Object} options
   * @param {string|void|null} [options.filename]
   * @param {Headers} [options.headers]
   */
  append(name, content, options = {}) {
    const chunks = []
    const file = options.filename || getFileName(content)
    const contentDisposition =
      file == null
        ? `form-data; name="${name}"`
        : `form-data; name="${name}"; filename="${encodeURIComponent(file)}"`

    chunks.push(`--${this.boundary}\r\n`)
    chunks.push(`Content-Disposition: ${contentDisposition}\r\n`)

    const { headers } = options
    if (headers) {
      if (!headers.has("Content-Type") && content instanceof Blob) {
        chunks.push(`Content-Type: ${content.type}\r\n`)
      }

      for (const [name, value] of headers.entries()) {
        chunks.push(`${name}: ${value}\r\n`)
      }
    } else if (content instanceof Blob) {
      chunks.push(`Content-Type: ${content.type}\r\n`)
    }

    chunks.push("\r\n")
    chunks.push(content)
    this.parts.push(new Blob(chunks))
  }

  toBlob() {
    const chunks = []
    let first = true
    for (const part of this.parts) {
      if (!first) {
        chunks.push("\r\n")
        chunks.push(part)
        first = false
      }
    }
    chunks.push(`\r\n--${this.boundary}--\r\n`)
    return new Blob(chunks, {
      type: `multipart/form-data; boundary=${this.boundary}`,
    })
  }
}
