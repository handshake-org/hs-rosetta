'use strict';

const currency = require('./currency');

class Output {
  constructor(output, index, network) {
    this.output = output;
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
        address: this.output.address.toString(this.network)
      },
      amount: {
        value: this.output.value.toString(),
        currency: currency
      },
      metadata: {}
    };
  }
}

module.exports = Output;
