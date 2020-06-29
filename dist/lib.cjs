'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var CID = _interopDefault(require('cids'));

class Client {
  /**
   * @param {Object} [options]
   * @param {URL} [options.url]
   * @param {number} [options.timeout]
   * @param {HeadersInit} [options.headers]
   */
  constructor(options = {}) {
    this.url = options.url || new URL("http://localhost:5001/api/v0/");
    this.timeout = options.timeout == null ? Infinity : options.timeout;
    this.headers = new Headers(options.headers);
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
    const url = new URL(resource, this.url);
    const request = new XMLHttpRequest();
    request.open(options.method || "GET", url.toString(), true);

    const timeout = options.timeout != null ? options.timeout : this.timeout;
    if (timeout > 0 && timeout < Infinity) {
      request.timeout = options.timeout;
    }

    for (const [name, value] of this.headers.entries()) {
      request.setRequestHeader(name, value);
    }

    for (const [name, value] of new Headers(options.headers).entries()) {
      request.setRequestHeader(name, value);
    }

    if (options.signal) {
      options.signal.onabort = () => request.abort();
    }

    if (options.progress) {
      request.onprogress = options.progress;
    }

    return new Promise((resolve, reject) => {
      /**
       * @param {Event} event
       */
      const handleEvent = (event) => {
        switch (event.type) {
          case "error": {
            resolve(Response.error());
            break
          }
          case "load": {
            resolve(
              new ResponseWithURL(request.responseURL, request.response, {
                status: request.status,
                statusText: request.statusText,
                headers: parseHeaders(request.getAllResponseHeaders()),
              })
            );
            break
          }
          case "timeout": {
            reject(new TimeoutError());
            break
          }
          case "abort": {
            reject(new AbortError());
            break
          }
        }
      };
      request.onerror = handleEvent;
      request.onload = handleEvent;
      request.ontimeout = handleEvent;
      request.onabort = handleEvent;

      request.send(options.body);
    })
  }
}

/**
 * @param {string} input
 */
const parseHeaders = (input) => {
  const headers = new Headers();
  for (const line of input.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(": ");
    if (index > 0) {
      headers.set(line.slice(0, index), line.slice(index + 1));
    }
  }

  return headers
};

class ResponseWithURL extends Response {
  /**
   * @param {string} url
   * @param {string|Blob|ArrayBufferView|ArrayBuffer|FormData|ReadableStream<Uint8Array>} body
   * @param {ResponseInit} options
   */
  constructor(url, body, options) {
    super(body, options);
    Object.defineProperty(this, "url", { value: url });
  }
}

class TimeoutError extends Error {}
class AbortError extends Error {}

/**
 * @param {BlobPart} content
 * @returns {string|null}
 */
const getFileName = (content) => {
  if (content instanceof File) {
    const name =
      // @ts-ignore - There is no File in node, but it's will be undefined
      content.filepath || content.webkitRelativePath || content.name || null;
    return name
  } else {
    return null
  }
};

class MultipartData {
  /**
   * @param {Object} [options]
   * @param {string} [options.boundary]
   */
  constructor(options = {}) {
    this.boundary =
      options.boundary ||
      `-----IPFSBlobServiceBoundery${Math.random().toString(32).slice(2)}`;

    /** @type {Blob[]} */
    this.parts = [];
  }

  /**
   * @param {string} name
   * @param {BlobPart} content
   * @param {Object} options
   * @param {string|void|null} [options.filename]
   * @param {Headers} [options.headers]
   */
  append(name, content, options = {}) {
    const chunks = [];
    const file = options.filename || getFileName(content);
    const contentDisposition =
      file == null
        ? `form-data; name="${name}"`
        : `form-data; name="${name}"; filename="${encodeURIComponent(file)}"`;

    chunks.push(`--${this.boundary}\r\n`);
    chunks.push(`Content-Disposition: ${contentDisposition}\r\n`);

    const { headers } = options;
    if (headers) {
      if (!headers.has("Content-Type") && content instanceof Blob) {
        chunks.push(`Content-Type: ${content.type}\r\n`);
      }

      for (const [name, value] of headers.entries()) {
        chunks.push(`${name}: ${value}\r\n`);
      }
    } else if (content instanceof Blob) {
      chunks.push(`Content-Type: ${content.type}\r\n`);
    }

    chunks.push("\r\n");
    chunks.push(content);
    this.parts.push(new Blob(chunks));
  }

  toBlob() {
    const chunks = [];
    for (const part of this.parts) {
    }
    chunks.push(`\r\n--${this.boundary}--\r\n`);
    return new Blob(chunks, {
      type: `multipart/form-data; boundary=${this.boundary}`,
    })
  }
}

// @ts-check

/**
 * @typedef {import('./client').Client} Client
 */
class BlobService {
  /**
   * @param {Client} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   *
   * @param {File & FileExt} file
   * @param {PutOptions} [options]
   *
   * @typedef {Object} PutOptions
   * @property {string} [chunker]
   * @property {0|1} [cidVersion]
   * @property {boolean} [enableShardingExperiment]
   * @property {string} [hashAlg]
   * @property {boolean} [onlyHash]
   * @property {boolean} [pin]
   * @property {boolean} [rawLeaves]
   * @property {boolean} [shardSplitThreshold]
   * @property {boolean} [trickle]
   * @property {boolean} [wrapWithDirectory]
   * @property {number} [timeout]
   * @property {AbortSignal} [signal]
   * @property {function({total:number, loaded:number}):void} [progress]
   *
   * @typedef {Object} FileExt
   * @property {string} [filepath]
   * @property {string} [webkitRelativePath]
   * @returns {Promise<AddedFile>}
   */
  async put(file, options = {}) {
    const [added] = await this.putAll([file], options);
    return added
  }

  /**
   *
   * @param {Array<File & FileExt>} files
   * @param {PutOptions} [options]
   * @returns {Promise<AddedFile []>}
   *
   * @typedef {Object} AddedFile
   * @property {CID} cid
   * @property {string} path
   * @property {number} size
   */
  async putAll(files, options = {}) {
    const searchParams = new URLSearchParams();
    searchParams.set("stream-channels", "true");
    const {
      chunker,
      cidVersion,
      hashAlg,
      onlyHash,
      pin,
      rawLeaves,
      trickle,
      wrapWithDirectory,
      timeout,
      signal,
      progress,
    } = options;

    if (progress != null) {
      searchParams.set("progress", "true");
    }

    if (trickle) {
      searchParams.set("trickle", "true");
    }

    if (onlyHash) {
      searchParams.set("only-hash", "true");
    }

    if (wrapWithDirectory) {
      searchParams.set("wrap-with-directory", "true");
    }

    if (chunker) {
      searchParams.set("chunker", chunker);
    }

    if (pin) {
      searchParams.set("pin", "true");
    }

    if (rawLeaves) {
      searchParams.set("raw-leaves", "true");
    }

    if (cidVersion) {
      searchParams.set("cid-version", "true");
    }

    if (hashAlg) {
      searchParams.set("hashAlg", "true");
    }

    const body = new MultipartData();

    for (const file of files) {
      body.append("file", file, {
        headers: lastModifiedHeaders(file),
      });
    }

    const response = await this.client.fetch("add", {
      method: "POST",
      body: body.toBlob(),
      searchParams,
      timeout,
      signal,
      progress,
    });

    if (response.ok) {
      const text = await response.text();
      return text
        .trim()
        .split("\n")
        .map((line) => decodeAddEntry(JSON.parse(line)))
    } else {
      throw new Error(response.statusText)
    }
  }
}

/**
 *
 * @param {AddData} data
 * @typedef {Object} AddData
 * @property {string} Hash
 * @property {string} Name
 * @property {string} Size
 * @property {number} Bytes
 */
const decodeAddEntry = (data) => {
  return {
    path: data.Name,
    size: parseInt(data.Size),
    cid: new CID(data.Hash),
  }
};

/**
 * @param {File} file
 */
const lastModifiedHeaders = (file) => {
  const ms = file.lastModified;
  const secs = Math.floor(ms / 1000);
  const nsecs = (ms - secs * 1000) * 1000;
  const headers = new Headers();
  headers.set("mtime", secs.toString());
  headers.set("mtime-nsecs", nsecs.toString());
  return headers
};

class IPFS {
  /**
   * @param {Object} [options]
   * @param {URL} [options.url]
   * @param {number} [options.timeout]
   * @param {HeadersInit} [options.headers]
   */
  constructor(options = {}) {
    const client = new Client(options);
    this.blob = new BlobService(client);
  }
}

exports.IPFS = IPFS;
