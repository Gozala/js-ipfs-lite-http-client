import { Client } from "./client.js"
import { BlobService } from "./blob-service.js"

class IPFS {
  /**
   * @param {Object} [options]
   * @param {URL} [options.url]
   * @param {number} [options.timeout]
   * @param {HeadersInit} [options.headers]
   */
  constructor(options = {}) {
    const client = new Client(options)
    this.blob = new BlobService(client)
  }
}

export { IPFS }
