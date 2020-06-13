/*!
 * network.js - network object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const pkg = require('./pkg');
const errs = require('./errs');

class List {
  constructor(network) {
    this.network = network;
  }

  toJSON() {
    return {
      network_identifiers: [{
        blockchain: pkg.blockchain,
        network: this.network.toString()
      }]
    };
  }
}

class Options {
  constructor(agent) {
    this.agent = agent;
  }

  toJSON() {
    return {
      version: {
        rosetta_version: pkg.rosetta,
        node_version: this.agent,
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
        ],
        errors: Object.values(errs)
      }
    };
  }
}

class Status {
  constructor(peers, tip, network) {
    this.peers = peers;
    this.tip = tip;
    this.network = network;
  }

  toJSON() {
    return {
      current_block_identifier: {
        index: this.tip.height,
        hash: this.tip.hash.toString('hex')
      },
        current_block_timestamp: this.tip.time * 1000,
        genesis_block_identifier: {
          index: this.network.genesis.height,
          hash: this.network.genesis.hash.toString('hex')
        },
        peers: this.peers
    };
  }
}

exports.NetworkList = List;
exports.NetworkOptions = Options;
exports.NetworkStatus = Status;
