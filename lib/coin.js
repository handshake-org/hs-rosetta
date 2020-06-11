/*!
 * coin.js - coin object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const currency = require('./currency');

class Coin {
  constructor(coin, input, index, network) {
    this.input = input;
    this.coin = coin;
    this.index = index;
    this.network = network;
  }

  toJSON() {
    return {
      operation_identifier: {
        index: this.index,
        network_index: 0
      },
      type: 'TRANSFER',
      status: 'SUCCESS',
      account: {
        address: this.coin.address.toString(this.network)
      },
      amount: {
        value: '-' + this.coin.value.toString(),
        currency: currency
      },
      metadata: {
        asm: this.input.witness.toASM(),
        hex: this.input.witness.toHex()
      }
    };
  }
}

module.exports = Coin;
