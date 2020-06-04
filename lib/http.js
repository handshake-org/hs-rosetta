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
const BlockMeta = require('./blockmeta');
const TX = require('./tx');
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
        code: err.code,
        message: err.message,
        retriable: true
      });
    });

    this.post('/network/list', async (req, res) => {
      const list = new NetworkList(this.network);
      res.json(200, list.toJSON());
    });

    this.post('/network/options', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      const options = new NetworkOptions(this.pool.options.agent);
      res.json(200, options.toJSON());
    });

    this.post('/network/status', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

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
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      enforce(valid.has('account_identifier'), 'Account is required');

      const address = valid.child('account_identifier').str('address');
      enforce(address, 'Address is required.');

      let hash;
      let height = 0;
      if (valid.has('block_identifier')) {
        hash = valid.child('block_identifier').uintbhash('hash');
        height = valid.child('block_identifier').uint('index');

        enforce(height != null, 'Height is required.');
      }

      let block;
      let balance = 0;
      if (height != null) {
        block = await this.chain.getBlock(height);

        if (!block) {
          res.json(404);
          return;
        }

        if (hash) {
          enforce(block.hashHex() === hash.toString('hex'), 'Block hash mismatch.');
        }

        balance = await this.chain.getBalanceAt(address, height);
      } else {
        const coins = await this.chain.getCoinsByAddress(address);
        height = this.chain.height;
        block = await this.chain.getBlock(height);

        for (const coin of coins)
          balance += coin.value;
      }

      const account = new Account(height, block, balance);
      res.json(200, account.balance.toJSON());
    });

    this.post('/block', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      enforce(valid.has('block_identifier'), 'Block is required');

      const hash = valid.child('block_identifier').uintbhash('hash');
      const height = valid.child('block_identifier').uint('index');

      enforce(height != null, 'Height is required.');

      const block = await this.chain.getBlock(height);

      if (!block) {
        res.json(404);
        return;
      }

      if (hash) {
        enforce(block.hashHex() === hash.toString('hex'), 'Block hash mismatch.');
      }

      const view = await this.chain.getBlockView(block);

      if (!view) {
        res.json(404);
        return;
      }

      const prev = new BlockMeta(height, block.hash());
      if (prev.height !== 0) {
        prev.height = await this.chain.getHeight(block.prevBlock);
        prev.hash = block.prevBlock;
      }

      const result = new Block(height, block, view, prev, this.network);
      res.json(200, result.toJSON());
    });

    this.post('/block/transaction', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      enforce(valid.has('block_identifier'), 'Block is required');
      enforce(valid.has('transaction_identifier'), 'Transaction is required');

      let hash = valid.child('block_identifier').uintbhash('hash');
      const height = valid.child('block_identifier').uint('index');

      enforce(height != null, 'Height is required.');

      const block = await this.chain.getBlock(height);

      if (!block) {
        res.json(404);
        return;
      }

      if (hash) {
        enforce(block.hashHex() === hash.toString('hex'), 'Block hash mismatch.');
      }

      hash = valid.child('transaction_identifier').uintbhash('hash');
      enforce(hash, 'Transaction hash is required');

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
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      res.json(200, {
          metadata: {
            recent_block_hash: this.chain.tip.hash.toString('hex')
          }
        }
      );
    });

    this.post('/construction/submit', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      enforce(valid.has('signed_transaction'), 'Signed transaction is required');
      const json = await this.rpc.call({
        method: 'sendrawtransaction',
        params: [req.body.signed_transaction]
      }, {});

      if (json.error) {
        res.json(500, {
          code: json.error.code,
          message: json.error.message,
          retriable: true
        });
        return;
      }

      res.json(200, {
          transaction_identifier: {
            hash: json.result
          }
        }
      );
    });

    this.post('/mempool', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      const txs = this.mempool.getSnapshot();

      const mempool = new Mempool(txs);
      res.json(200, mempool.toJSON());
    });

    this.post('/mempool/transaction', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), 'Network is required');

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, 'Invalid blockchain');
      enforce(network === this.network.toString(), 'Invalid network.');

      enforce(valid.has('transaction_identifier'), 'Transaction is required');
      const hash = valid.child('transaction_identifier').uintbhash('hash');
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
 * Helpers
 */

function enforce(value, msg) {
  if (!value) {
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

/*
 * Expose
 */

module.exports = HTTP;
