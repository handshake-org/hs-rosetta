/*!
 * tx.js - tx object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const Op = require('./op');
const util = require('./util');

class TX {
  constructor(tx, view, network) {
    this.tx = tx;
    this.view = view;
    this.network = network;
  }

  operations() {
    const operations = [];

    if (!this.tx.isCoinbase()) {
      for (const input of this.tx.inputs) {
        const coin = this.view.getCoinFor(input);

        const addr = coin.getHash();

        if (!addr)
          continue;

        if (util.isUnspendable(coin.covenant))
          continue;

        const address = coin.address.toString(this.network);
        const value = '-' + coin.value.toString();
        const metadata = {
          asm: input.witness.toASM(),
          hex: input.witness.toHex()
        };

        const op = new Op(operations.length, address, value, metadata);
        operations.push(op);
      }
    }

    for (const output of this.tx.outputs) {
      if (output.isUnspendable())
        continue;

      const addr = output.getHash();

      if (!addr)
        continue;

      if (util.isUnspendable(output.covenant))
        continue;

      const address = output.address.toString(this.network);
      const value = output.value.toString();
      const op = new Op(operations.length, address, value);

      operations.push(op);
    }

    return operations;
  }

  toJSON() {
    return {
      transaction_identifier: {
        hash: this.tx.hash().toString('hex')
      },
      operations: this.operations(),
      metadata: {
        size: this.tx.getSize(),
        lockTime: this.tx.locktime
      }
    };
  }
}

module.exports = TX;
