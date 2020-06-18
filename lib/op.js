/*!
 * op.js - operation object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const currency = require('./currency');

class Op {
  constructor(index, address, value, metadata) {
    this.index = index;
    this.address = address;
    this.value = value;
    this.metadata = metadata || {};
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
        address: this.address.toString(this.network)
      },
      amount: {
        value: this.value.toString(),
        currency: currency
      },
      metadata: this.metadata
    };
  }
}

module.exports = Op;
