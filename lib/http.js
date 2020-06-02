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

const {NetworkList, NetworkOptions, NetworkStatus} = require('./network');
const Account = require('./account');
const Mempool = require('./mempool');
const Block = require('./block');
const Prev = require('./prev');
const TX = require('./tx');


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

    this.logger = this.options.logger.context('hs-rosetta');
    this.node = this.options.node;

    this.network = this.node.network;
    this.chain = this.node.chain;
    this.mempool = this.node.mempool;
    this.rpc = this.node.rpc;
    this.pool = this.node.pool;

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
      // TODO: openapi - parse request data
      const list = new NetworkList(this.network);
      res.json(200, list.toJSON());
    });

    this.post('/network/options', async (req, res) => {
      // TODO: openapi - parse request data
      const options = new NetworkOptions(this.pool.options.agent);
      res.json(200, options.toJSON());
    });

    this.post('/network/status', async (req, res) => {
      // TODO: openapi - parse request data
      const peers = [];
      for (let peer = this.pool.peers.head(); peer; peer = peer.next) {
        if (!peer.connected)
          continue;
        peers.push({
          peer_id: peer.hostname()
        });
      }

      const status = new NetworkStatus(peers, this.chain.tip, this.network);
      res.json(200, status.toJSON());
    });

    this.post('/account/balance', async (req, res) => {
      // TODO: openapi - parse request data
      const address = new Validator(req.body.account_identifier).str('address');
      const hash = new Validator(req.body.block_identifier).uintbhash('hash');
      const height = new Validator(req.body.block_identifier).uint('index');

      const block = await this.chain.getBlock(height);

      if (!block) {
        res.json(404);
        return;
      }

      const balance = await this.chain.getBalanceAt(address, height);

      const account = new Account(height, block, balance);
      res.json(200, account.balance.toJSON());
    });

    this.post('/block', async (req, res) => {
      // TODO: openapi - parse request data
      const valid = new Validator(req.body.block_identifier);
      const hash = valid.uintbhash('hash');
      const height = valid.uint('index');

      const block = await this.chain.getBlock(height);

      if (!block) {
        res.json(404);
        return;
      }

      const view = await this.chain.getBlockView(block);

      if (!view) {
        res.json(404);
        return;
      }

      const prev = new Prev(height, block);
      if (prev.height !== 0) {
        prev.height = await this.chain.getHeight(block.prevBlock);
        prev.hash = block.prevBlock.toString('hex');
      }

      const result = new Block(height, block, view, prev, this.network);
      res.json(200, result.toJSON());
    });

    this.post('/block/transaction', async (req, res) => {
      // TODO: openapi - parse request data
      let valid = new Validator(req.body.block_identifier);
      let hash = valid.uintbhash('hash');

      const block = await this.chain.getBlock(hash);

      if (!block) {
        res.json(404);
        return;
      }

      valid = new Validator(req.body.transaction_identifier);
      hash = valid.uintbhash('hash');

      const tx = await this.chain.getTX(hash);

      if (!tx) {
        res.json(404);
        return;
      }

      const view = await this.chain.getBlockView(block);

      if (!view) {
        res.json(404);
        return;
      }

      const transaction = new TX(tx, view, this.network);
      res.json(200, {transaction: transaction.toJSON()});
    });

    this.post('/construction/metadata', async (req, res) => {
      // TODO: openapi - parse request data
      res.json(200,
        {
          metadata: {
            // TODO: account_sequence: 23,
            recent_block_hash: this.chain.tip.hash.toString('hex')
          }
        }
      );
    });

    this.post('/construction/submit', async (req, res) => {
      // TODO: openapi - parse request data
      const json = await this.rpc.call({
        method: 'sendrawtransaction',
        params: [req.body.signed_transaction]
      }, {});

      // TODO: handle json.error
      res.json(200,
        {
          transaction_identifier: {
            hash: json.result
          }
        }
      );
    });

    this.post('/mempool', async (req, res) => {
      // TODO: openapi - parse request data
      const txs = this.mempool.getSnapshot();

      const mempool = new Mempool(txs);
      res.json(200, mempool.toJSON());
    });

    this.post('/mempool/transaction', async (req, res) => {
      // TODO: openapi - parse request data
      const hash = new Validator(req.body.transaction_identifier).uintbhash('hash');
      const tx = this.mempool.getTX(hash);

      if (!tx) {
        res.json(404);
        return;
      }

      const view = await this.mempool.getCoinView(tx);

      if (!view) {
        res.json(404);
        return;
      }

      const transaction = new TX(tx, view, this.network);
      res.json(200, {transaction: transaction.toJSON()});
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

/*
 * Expose
 */

module.exports = HTTP;
