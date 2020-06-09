/*!
 * account.js - account object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const currency = require('./currency');

class AccountBalance {
  constructor(height, block, balance) {
    this.height = height;
    this.block = block;
    this.balance = balance;
  }

  toJSON() {
    return {
      block_identifier: {
        index: this.height,
        hash: this.block.hash().toString('hex')
      },
      balances: [
        {
          value: this.balance.toString(),
          currency: currency
        }
      ]
    };
  }
}

module.exports = AccountBalance;
