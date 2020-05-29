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

    this.logger = this.options.logger.context('hs-rosetta');
    this.node = this.options.node;

    this.network = this.node.network;
    this.chain = this.node.chain;
    this.mempool = this.node.mempool;
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
            node_version: this.pool.options.agent,
            middleware_version: pkg.version
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
      const peers = [];
      for (let peer = this.pool.peers.head(); peer; peer = peer.next) {
        if (!peer.connected)
          continue;
        peers.push({
          peer_id: peer.hostname()
        });
      }
      res.json(200,
        {
          current_block_identifier: {
            index: this.chain.height,
            hash: this.chain.tip.hash.toString('hex')
          },
          current_block_timestamp: this.chain.tip.time * 1000,
          genesis_block_identifier: {
            index: this.network.genesis.height,
            hash: this.network.genesis.hash.toString('hex')
          },
          peers: peers
        }
      );
    });

    this.post('/account/balance', async (req, res) => {
      // TODO: openapi - parse request data
      const address = new Validator(req.body.account_identifier).str('address');
      const hash = new Validator(req.body.block_identifier).uintbhash('hash');
      const height = new Validator(req.body.block_identifier).uint('index');

      const block = await this.chain.getBlock(height);
      const balance = await this.chain.getBalanceAt(address, height);

      res.json(200,
        {
          block_identifier: {
            index: height,
            hash: block.hash().toString('hex')
          },
          balances: [
            {
              value: balance.toString(),
              currency: {
                symbol: pkg.unit.toUpperCase(),
                decimals: pkg.decimals,
                metadata: {
                  Issuer: pkg.organization
                }
              }
            }
          ]
        }
      );
    });

    this.post('/block', async (req, res) => {
      // TODO: openapi - parse request data
      const valid = new Validator(req.body.block_identifier);
      const hash = valid.uintbhash('hash');
      const index = valid.uint('index');

      const block = await this.chain.getBlock(index);
      const view = await this.chain.getBlockView(block);

      if (!view) {
        res.json(404);
        return;
      }

      let prevHeight = 0;
      let prevHash = block.hash().toString('hex');

      // See: https://djr6hkgq2tjcs.cloudfront.net/docs/CommonMistakes.html#malformed-genesis-block
      if (index !== 0) {
        prevHeight = await this.chain.getHeight(block.prevBlock);
        prevHash = block.prevBlock.toString('hex');
      }

      const transactions = [];
      block.txs.map((tx) => {
        const operations = [];

        tx.outputs.map((output) => {
          operations.push(
            {
              operation_identifier: {
                index: operations.length,
                network_index: 0
              },
              type: 'TRANSFER',
              status: 'SUCCESS',
              account: {
                address: output.address.toString(this.network)
              },
              amount: {
                value: output.value.toString(),
                currency: {
                  symbol: pkg.unit.toUpperCase(),
                  decimals: pkg.decimals,
                  metadata: {
                    Issuer: pkg.organization
                  }
                }
              },
              metadata: {} // TODO: covenant hex/asm?
            }
          );
        });

        if (!tx.isCoinbase()) {
          tx.inputs.map((input) => {
            const coin = view.getCoinFor(input);
            operations.push(
              {
                operation_identifier: {
                  index: operations.length,
                  network_index: 0
                },
                type: 'TRANSFER',
                status: 'SUCCESS',
                account: {
                  address: coin.address.toString(this.network)
                },
                amount: {
                  value: '-' + coin.value.toString(),
                  currency: {
                    symbol: pkg.unit.toUpperCase(),
                    decimals: pkg.decimals,
                    metadata: {
                      Issuer: pkg.organization
                    }
                  }
                },
                metadata: {
                  asm: input.witness.toASM(),
                  hex: input.witness.toHex()
                }
              }
            );
          });
        }

        transactions.push(
          {
            transaction_identifier: {
              hash: tx.hash().toString('hex')
            },
            operations: operations,
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
              index: index,
              hash: block.hash().toString('hex')
            },
            parent_block_identifier: {
              index: prevHeight,
              hash: prevHash
            },
            timestamp: block.time * 1000,
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

    this.post('/block/transaction', async (req, res) => {
      // TODO: openapi - parse request data
      let valid = new Validator(req.body.block_identifier);
      let hash = valid.uintbhash('hash');

      const block = await this.chain.getBlock(hash);

      valid = new Validator(req.body.transaction_identifier);
      hash = valid.uintbhash('hash');

      const tx = await this.chain.getTX(hash);

      const view = await this.chain.getBlockView(block);

      if (!view) {
        res.json(404);
        return;
      }

      const operations = [];

      tx.outputs.map((output) => {
        operations.push(
          {
            operation_identifier: {
              index: operations.length,
              network_index: 0
            },
            type: 'TRANSFER',
            status: 'SUCCESS',
            account: {
              address: output.address.toString(this.network)
            },
            amount: {
              value: output.value.toString(),
              currency: {
                symbol: pkg.unit.toUpperCase(),
                decimals: pkg.decimals,
                metadata: {
                  Issuer: pkg.organization
                }
              }
            },
            metadata: {} // TODO: covenant hex/asm?
          }
        );
      });

      if (!tx.isCoinbase()) {
        tx.inputs.map((input) => {
          const coin = view.getCoinFor(input);
          operations.push(
            {
              operation_identifier: {
                index: operations.length,
                network_index: 0
              },
              type: 'TRANSFER',
              status: 'SUCCESS',
              account: {
                address: coin.address.toString(this.network)
              },
              amount: {
                value: '-' + coin.value.toString(),
                currency: {
                  symbol: pkg.unit.toUpperCase(),
                  decimals: pkg.decimals,
                  metadata: {
                    Issuer: pkg.organization
                  }
                }
              },
              metadata: {
                asm: input.witness.toASM(),
                hex: input.witness.toHex()
              }
            }
          );
        });
      }

      res.json(200,
        {
          transaction_identifier: {
            hash: tx.hash().toString('hex')
          },
          operations: operations,
          metadata: {
            size: tx.getSize(),
            lockTime: tx.locktime
          }
        }
      );
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
      const json = await this.node.rpc.call({
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
      const transactions = [];
      const hashes = this.mempool.getSnapshot();
      for (const hash of hashes)
        transactions.push(hash.toString('hex'));


      res.json(200,
        {
          "transaction_identifiers": transactions
        }
      );
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

      const operations = [];
      tx.outputs.map((output) => {
        operations.push(
          {
            operation_identifier: {
              index: operations.length,
              network_index: 0
            },
            type: 'TRANSFER',
            status: 'SUCCESS',
            account: {
              address: output.address.toString(this.network)
            },
            amount: {
              value: output.value.toString(),
              currency: {
                symbol: pkg.unit.toUpperCase(),
                decimals: pkg.decimals,
                metadata: {
                  Issuer: pkg.organization
                }
              }
            },
            metadata: {} // TODO: covenant hex/asm?
          }
        );
      });

      if (!tx.isCoinbase()) {
        tx.inputs.map((input) => {
          const coin = view.getCoinFor(input);
          operations.push(
            {
              operation_identifier: {
                index: operations.length,
                network_index: 0
              },
              type: 'TRANSFER',
              status: 'SUCCESS',
              account: {
                address: coin.address.toString(this.network)
              },
              amount: {
                value: '-' + coin.value.toString(),
                currency: {
                  symbol: pkg.unit.toUpperCase(),
                  decimals: pkg.decimals,
                  metadata: {
                    Issuer: pkg.organization
                  }
                }
              },
              metadata: {
                asm: input.witness.toASM(),
                hex: input.witness.toHex()
              }
            }
          );
        });
      }

      res.json(200,
        {
          transaction: {
            transaction_identifier: {
              hash: hash.toString('hex')
            },
            operations: operations,
            metadata: {
              size: tx.getSize(),
              lockTime: tx.locktime
            }
          }
          // TODO:
          //metadata: {
            //descendant_fees: 123923,
            //ancestor_count: 2
          //}
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
