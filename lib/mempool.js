'use strict';

class Mempool {
  constructor(txs) {
    this.txs = txs;
  }

  hashes() {
    const hashes = [];
    for (const tx of this.txs)
      hashes.push(tx.toString('hex'));
    return hashes;
  }

  toJSON() {
    return {
      'transaction_identifiers': this.hashes()
    };
  }
}

module.exports = Mempool;
