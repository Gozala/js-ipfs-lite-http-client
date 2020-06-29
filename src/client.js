"use strict"

export class Client {
  /**
   * @param {Object} [options]
   * @param {URL} [options.url]
   * @param {number} [options.timeout]
   * @param {HeadersInit} [options.headers]
   */
  constructor(options = {}) {
    this.url = options.url || new URL("http://localhost:5001/api/v0/")
    this.timeout = options.timeout == null ? Infinity : options.timeout
    this.headers = new Headers(options.headers)
  }
  /**
   * @param {string} resource
   * @param {FetchOptions} [options]
   *
   * @typedef {RequestInit & ExtraFetchOptions} FetchOptions
   * @typedef {Object} ExtraFetchOptions
   * @property {number} [timeout]
   * @property {URLSearchParams} [searchParams]
   * @property {function({total:number, loaded:number}):void} [progress]
   * @returns {Promise<Response>}
   */
  fetch(resource, options = {}) {
    const url = new URL(resource, this.url)
    const request = new XMLHttpRequest()
    request.open(options.method || "GET", url.toString(), true)

    const timeout = options.timeout != null ? options.timeout : this.timeout
    if (timeout > 0 && timeout < Infinity) {
      request.timeout = options.timeout
    }

    for (const [name, value] of this.headers.entries()) {
      request.setRequestHeader(name, value)
    }

    for (const [name, value] of new Headers(options.headers).entries()) {
      request.setRequestHeader(name, value)
    }

    if (options.signal) {
      options.signal.onabort = () => request.abort()
    }

    if (options.progress) {
      request.onprogress = options.progress
    }

    return new Promise((resolve, reject) => {
      /**
       * @param {Event} event
       */
      const handleEvent = (event) => {
        switch (event.type) {
          case "error": {
            resolve(Response.error())
            break
          }
          case "load": {
            resolve(
              new ResponseWithURL(request.responseURL, request.response, {
                status: request.status,
                statusText: request.statusText,
                headers: parseHeaders(request.getAllResponseHeaders()),
              })
            )
            break
          }
          case "timeout": {
            reject(new TimeoutError())
            break
          }
          case "abort": {
            reject(new AbortError())
            break
          }
        }
      }
      request.onerror = handleEvent
      request.onload = handleEvent
      request.ontimeout = handleEvent
      request.onabort = handleEvent

      request.send(options.body)
    })
  }
}

/**
 * @param {string} input
 */
const parseHeaders = (input) => {
  const headers = new Headers()
  for (const line of input.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(": ")
    if (index > 0) {
      headers.set(line.slice(0, index), line.slice(index + 1))
    }
  }

  return headers
}

class ResponseWithURL extends Response {
  /**
   * @param {string} url
   * @param {string|Blob|ArrayBufferView|ArrayBuffer|FormData|ReadableStream<Uint8Array>} body
   * @param {ResponseInit} options
   */
  constructor(url, body, options) {
    super(body, options)
    Object.defineProperty(this, "url", { value: url })
  }
}

class TimeoutError extends Error {}
class AbortError extends Error {}
