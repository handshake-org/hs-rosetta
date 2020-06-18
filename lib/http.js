/*!
 * http.js - rosetta http server for hsd.
 * Copyright (c) 2020, The Handshake Developers (MIT License).
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const assert = require('bsert');
const path = require('path');

const hsd = require('hsd');
const Validator = require('bval');
const {Server} = require('bweb');

const base58 = require('bcrypto/lib/encoding/base58');
const sha256 = require('bcrypto/lib/sha256');
const random = require('bcrypto/lib/random');

const {NetworkList, NetworkOptions, NetworkStatus} = require('./network');
const AccountBalance = require('./account');
const Mempool = require('./mempool');
const Block = require('./block');
const BlockMeta = require('./blockmeta');
const TX = require('./tx');
const pkg = require('./pkg');
const errs = require('./errs');
const util = require('./util');

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

    assert(this.chain.options.indexTX, 'index-tx is required');
    assert(this.chain.options.indexAddress, 'index-address is required');

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
      this.logger.info('Rosetta HTTP server listening on %s (port=%d).',
        address.address, address.port);
    });

    this.on('error', (err) => {
      console.error(err);
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
        code: err.code || 32,
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
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      const options = new NetworkOptions(this.pool.options.agent);
      res.json(200, options.toJSON());
    });

    this.post('/network/status', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);
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
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      enforce(valid.has('account_identifier'), errs.ACCOUNT_REQUIRED);

      const address = valid.child('account_identifier').str('address');
      enforce(address, errs.ADDRESS_REQUIRED);

      let height;
      if (valid.has('block_identifier')) {
        height = valid.child('block_identifier').uint('index');

        enforce(height != null, errs.BLOCK_HEIGHT_REQUIRED);
      }

      // We do not support querying account balance by height yet.
      if (height != null) {
        throw errs.QUERY_NOT_SUPPORTED;
      }

      height = this.chain.height;
      const coins = await this.chain.getCoinsByAddress(address);
      const block = await this.chain.getBlock(height);

      if (!block) {
        throw errs.BLOCK_NOT_FOUND;
      }

      let balance = 0;
      for (const coin of coins) {
        if (coin.address.isUnspendable())
          continue;

        if (coin.covenant.isUnspendable())
          continue;

        if (util.isUnspendable(coin.covenant))
          continue;

        balance += coin.value;
      }

      const account = new AccountBalance(height, block, balance);
      res.json(200, account.toJSON());
    });

    this.post('/block', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      enforce(valid.has('block_identifier'), errs.BLOCK_REQUIRED);

      const hash = valid.child('block_identifier').uintbhash('hash');
      const height = valid.child('block_identifier').uint('index');

      enforce(height != null, errs.BLOCK_HEIGHT_REQUIRED);

      const block = await this.chain.getBlock(height);

      if (!block) {
        throw errs.BLOCK_NOT_FOUND;
      }

      if (hash) {
        enforce(block.hashHex() === hash.toString('hex'),
          errs.BLOCK_HASH_MISMATCH);
      }

      const view = await this.chain.getBlockView(block);

      if (!view) {
        throw errs.BLOCK_NOT_FOUND;
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
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      enforce(valid.has('block_identifier'), errs.BLOCK_REQUIRED);
      enforce(valid.has('transaction_identifier'), errs.TX_REQUIRED);

      let hash = valid.child('block_identifier').uintbhash('hash');
      const height = valid.child('block_identifier').uint('index');

      enforce(height != null, errs.BLOCK_HEIGHT_REQUIRED);

      const block = await this.chain.getBlock(height);

      if (!block) {
        throw errs.BLOCK_NOT_FOUND;
      }

      if (hash) {
        enforce(block.hashHex() === hash.toString('hex'),
          errs.BLOCK_HASH_MISMATCH);
      }

      hash = valid.child('transaction_identifier').uintbhash('hash');
      enforce(hash, errs.TX_HASH_REQUIRED);

      const tx = await this.chain.getTX(hash);

      if (!tx) {
        throw errs.TX_NOT_FOUND;
      }

      const view = await this.chain.getBlockView(block);

      if (!view) {
        throw errs.VIEW_NOT_FOUND;
      }

      const transaction = new TX(tx, view, this.network);
      res.json(200, {transaction: transaction.toJSON()});
    });

    this.post('/construction/metadata', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);
      enforce(valid.has('options'), errs.OPTIONS_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      res.json(200, {
          metadata: {
            recent_block_hash: this.chain.tip.hash.toString('hex')
          }
        }
      );
    });

    this.post('/construction/submit', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      enforce(valid.buf('signed_transaction'), errs.INVALID_SIGNED_TX);

      let raw, tx;
      try {
        raw = valid.buf('signed_transaction');
        tx = hsd.TX.decode(raw);
      } catch (err) {
        throw errs.INVALID_TX;
      }

      try {
        await this.mempool.addTX(tx);
        this.pool.broadcast(tx);
      } catch (err) {
        throw errs.TX_RELAY_ERROR;
      }

      res.json(200, {
        transaction_identifier: {
          hash: tx.txid()
        }
      });
    });

    this.post('/mempool', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      const txs = this.mempool.getSnapshot();

      const mempool = new Mempool(txs);
      res.json(200, mempool.toJSON());
    });

    this.post('/mempool/transaction', async (req, res) => {
      const valid = Validator.fromRequest(req);
      enforce(valid.has('network_identifier'), errs.NETWORK_REQUIRED);

      const blockchain = valid.child('network_identifier').str('blockchain');
      const network = valid.child('network_identifier').str('network');

      enforce(blockchain === pkg.blockchain, errs.INVALID_BLOCKCHAIN);
      enforce(network === this.network.toString(), errs.INVALID_NETWORK);

      enforce(valid.has('transaction_identifier'), errs.TX_REQUIRED);
      const hash = valid.child('transaction_identifier').uintbhash('hash');
      const tx = this.mempool.getTX(hash);

      if (!tx) {
        throw errs.TX_NOT_FOUND;
      }

      const view = await this.mempool.getCoinView(tx);

      if (!view) {
        throw errs.VIEW_NOT_FOUND;
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
      'Rosetta HTTP Server requires a Node.');

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
}

/*
 * Helpers
 */

function enforce(value, err) {
  if (!value) {
    throw err;
  }
}

/*
 * Expose
 */

module.exports = HTTP;
