/*!
 * http.js - http server for hsd
 * Copyright (c) 2020, The Handshake Developers (MIT License).
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('bsert');
const path = require('path');
const Validator = require('bval');
const {Server} = require('bweb');
const base58 = require('bcrypto/lib/encoding/base58');
const sha256 = require('bcrypto/lib/sha256');
const random = require('bcrypto/lib/random');
const pkg = require('./pkg');

/**
 * HTTP
 * @alias module:http.Server
 */

class HTTP extends Server {
  /**
   * Create an http server.
   * @constructor
   * @param {Object} options
   */

  constructor(options) {
    super(new HTTPOptions(options));

    this.logger = this.options.logger.context('hrosetta');
    this.node = this.options.node;

    this.network = this.node.network;
    this.chain = this.node.chain;
    this.mempool = this.node.mempool;
    this.pool = this.node.pool;
    this.fees = this.node.fees;
    this.miner = this.node.miner;
    this.rpc = this.node.rpc;

    this.init();
  }

  /**
   * Initialize routes.
   * @private
   */

  init() {
    this.on('request', (req, res) => {
      if (req.method === 'POST' && req.pathname === '/')
        return;

      this.logger.debug('Request for method=%s path=%s (%s).',
        req.method, req.pathname, req.socket.remoteAddress);
    });

    this.on('listening', (address) => {
      this.logger.info('Node HTTP server listening on %s (port=%d).',
        address.address, address.port);
    });

    this.initRouter();
  }

  /**
   * Initialize routes.
   * @private
   */

  initRouter() {
    if (this.options.cors)
      this.use(this.cors());

    if (!this.options.noAuth) {
      this.use(this.basicAuth({
        hash: sha256.digest,
        password: this.options.apiKey,
        realm: 'node'
      }));
    }

    this.use(this.bodyParser({
      type: 'json'
    }));

    this.use(this.jsonRPC());
    this.use(this.router());

    this.error((err, req, res) => {
      const code = err.statusCode || 500;
      res.json(code, {
        error: {
          type: err.type,
          code: err.code,
          message: err.message
        }
      });
    });

    this.post('/network/list', async (req, res) => {
      res.json(200,
        {
          network_identifiers: [
            {
              blockchain: pkg.currency,
              network: this.node.network.toString()
            }
          ]
        }
      );
    });

    this.post('/network/options', async (req, res) => {
      // TODO: openapi - parse request data
      res.json(200,
        {
          version: {
            rosetta_version: '1.3.1',
            node_version: process.version,
            middleware_version: pkg.version,
            metadata: {}
          },
          allow: {
            operation_statuses: [
              {
                status: 'SUCCESS',
                successful: true
              }
            ],
            operation_types: [
              'TRANSFER'
            ]
          }
        }
      );
    });

    this.post('/network/status', async (req, res) => {
      // TODO: openapi - parse request data
      res.json(200,
        {
          current_block_identifier: {
            index: this.chain.height,
            hash: this.chain.tip.hash.toString('hex')
          },
          current_block_timestamp: this.chain.tip.time,
          genesis_block_identifier: {
            index: this.network.genesis.height,
            hash: this.network.genesis.hash.toString('hex')
          }
          // TODO
          /*
           *peers: [
           *  {
           *    peer_id: '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
           *    metadata: {}
           *  }
           *]
           */
        }
      );
    });

    this.post('/block', async (req, res) => {
      // TODO: openapi - parse request data
      const valid = new Validator(req.body.block_identifier);
      const hash = valid.uintbhash('hash');

      const block = await this.chain.getBlock(hash);
      const transactions = [];
      block.txs.map((tx) => {
        transactions.push(
          {
            transaction_identifier: {
              hash: tx.hash.toString('hex')
            },
            metadata: {
              size: tx.getSize(),
              lockTime: tx.locktime
            }
          }
        );
      });
      res.json(200,
        {
          block: {
            block_identifier: {
              index: block.height,
              hash: block.hash.toString('hex')
            },
            parent_block_identifier: {
              index: block.height - 1, // TODO: verify from db
              hash: block.prevBlock
            },
            timestamp: block.time,
            transactions: transactions,
            metadata: {
              transactions_root:
              block.merkleRoot.toString('hex'),
              difficulty: toDifficulty(block.bits)
            }
          }
        }
      );
    });
  }
}

class HTTPOptions {
  /**
   * HTTPOptions
   * @alias module:http.HTTPOptions
   * @constructor
   * @param {Object} options
   */

  constructor(options) {
    this.logger = null;
    this.node = null;
    this.apiKey = base58.encode(random.randomBytes(20));
    this.apiHash = sha256.digest(Buffer.from(this.apiKey, 'ascii'));
    this.noAuth = false;
    this.cors = false;

    this.prefix = null;
    this.host = '127.0.0.1';
    this.port = 8080;
    this.ssl = false;
    this.keyFile = null;
    this.certFile = null;

    this.fromOptions(options);
  }

  /**
   * Inject properties from object.
   * @private
   * @param {Object} options
   * @returns {HTTPOptions}
   */

  fromOptions(options) {
    assert(options);
    assert(options.node && typeof options.node === 'object',
      'HTTP Server requires a Node.');

    this.node = options.node;
    this.logger = options.node.logger;

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }

    if (options.apiKey != null) {
      assert(typeof options.apiKey === 'string',
        'API key must be a string.');
      assert(options.apiKey.length <= 255,
        'API key must be under 256 bytes.');
      this.apiKey = options.apiKey;
      this.apiHash = sha256.digest(Buffer.from(this.apiKey, 'ascii'));
    }

    if (options.noAuth != null) {
      assert(typeof options.noAuth === 'boolean');
      this.noAuth = options.noAuth;
    }

    if (options.cors != null) {
      assert(typeof options.cors === 'boolean');
      this.cors = options.cors;
    }

    if (options.prefix != null) {
      assert(typeof options.prefix === 'string');
      this.prefix = options.prefix;
      this.keyFile = path.join(this.prefix, 'key.pem');
      this.certFile = path.join(this.prefix, 'cert.pem');
    }

    if (options.host != null) {
      assert(typeof options.host === 'string');
      this.host = options.host;
    }

    if (options.port != null) {
      assert((options.port & 0xffff) === options.port,
        'Port must be a number.');
      this.port = options.port;
    }

    if (options.ssl != null) {
      assert(typeof options.ssl === 'boolean');
      this.ssl = options.ssl;
    }

    if (options.keyFile != null) {
      assert(typeof options.keyFile === 'string');
      this.keyFile = options.keyFile;
    }

    if (options.certFile != null) {
      assert(typeof options.certFile === 'string');
      this.certFile = options.certFile;
    }

    // Allow no-auth implicitly
    // if we're listening locally.
    if (!options.apiKey) {
      if (this.host === '127.0.0.1' || this.host === '::1')
        this.noAuth = true;
    }

    return this;
  }

  /**
   * Instantiate http options from object.
   * @param {Object} options
   * @returns {HTTPOptions}
   */

  static fromOptions(options) {
    return new HTTPOptions().fromOptions(options);
  }
}

function toDifficulty(bits) {
  let shift = (bits >>> 24) & 0xff;
  let diff = 0x0000ffff / (bits & 0x00ffffff);

  while (shift < 29) {
    diff *= 256.0;
    shift++;
  }

  while (shift > 29) {
    diff /= 256.0;
    shift--;
  }

  return diff;
}

/*
 * Expose
 */

module.exports = HTTP;
