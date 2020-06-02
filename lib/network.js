const pkg = require('./pkg');


class List {
  constructor(network) {
    this.network = network;
  }

  toJSON() {
    return {
      network_identifiers: [{
        blockchain: pkg.currency,
        network: this.network.toString()
      }]
    }
  }
}

class Options {
  constructor(pool) {
    this.pool = pool;
  }

  toJSON() {
    return {
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
  }
}

class Status {
  constructor(chain, pool, network) {
    this.chain = chain;
    this.pool = pool;
    this.network = network;
  }

  peers() {
    const peers = [];
    for (let peer = this.pool.peers.head(); peer; peer = peer.next) {
      if (!peer.connected)
        continue;
      peers.push({
        peer_id: peer.hostname()
      });
    }
    return peers;
  }

  toJSON() {
    return {
      current_block_identifier: {
        index: this.chain.height,
          hash: this.chain.tip.hash.toString('hex')
      },
        current_block_timestamp: this.chain.tip.time * 1000,
        genesis_block_identifier: {
          index: this.network.genesis.height,
            hash: this.network.genesis.hash.toString('hex')
        },
        peers: this.peers()
    }
  }
}

class Network {
  constructor(node) {
    this.list = new List(node.network);
    this.options = new Options(node.pool);
    this.status = new Status(node.chain, node.pool, node.network);
  }
}

module.exports = Network;
