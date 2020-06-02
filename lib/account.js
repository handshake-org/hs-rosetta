const pkg = require('./pkg');


class Balance {
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
    }
  }
}

class Account {
  constructor(height, block, balance) {
    this.balance = new Balance(height, block, balance);
  }
}

module.exports = Account;
