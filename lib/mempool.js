/*!
 * mempool.js - mempool object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

class Mempool {
  constructor(txs) {
    this.txs = txs;
  }

  hashes() {
    const hashes = [];
    for (const tx of this.txs)
      hashes.push({
        hash: tx.toString('hex')
      });
    return hashes;
  }

  toJSON() {
    return {
      'transaction_identifiers': this.hashes()
    };
  }
}

module.exports = Mempool;
