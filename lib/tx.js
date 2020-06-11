/*!
 * tx.js - tx object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const Coin = require('./coin');
const Output = require('./output');

const CovenantTypes = require('./covenant');

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

        // REGISTER->REVOKE covenants have no effect.
        if (coin.covenant.type >= CovenantTypes.REGISTER
          && coin.covenant.type <= CovenantTypes.REVOKE) {
          continue;
        }

        operations.push(new Coin(coin, input, operations.length, this.network));
      }
    }

    for (const output of this.tx.outputs) {
      if (output.isUnspendable())
        continue;

      const addr = output.getHash();

      if (!addr)
        continue;

      // REGISTER->REVOKE covenants have no effect.
      if (output.covenant.type >= CovenantTypes.REGISTER
        && output.covenant.type <= CovenantTypes.REVOKE) {
        continue;
      }

      operations.push(new Output(output, operations.length ,this.network));
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
