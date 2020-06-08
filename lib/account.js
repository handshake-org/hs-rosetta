'use strict';

const pkg = require('./pkg');

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
          currency: {
            symbol: pkg.unit.toUpperCase(),
            decimals: pkg.decimals,
            metadata: {
              Issuer: pkg.organization
            }
          }
        }
      ]
    };
  }
}

module.exports = AccountBalance;
