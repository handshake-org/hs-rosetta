const pkg = require('./pkg');


const CovenantTypes = {
  NONE: 0,
  CLAIM: 1,
  OPEN: 2,
  BID: 3,
  REVEAL: 4,
  REDEEM: 5,
  REGISTER: 6,
  UPDATE: 7,
  RENEW: 8,
  TRANSFER: 9,
  FINALIZE: 10,
  REVOKE: 11
};

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

        operations.push(
          {
            operation_identifier: {
              index: operations.length,
              network_index: 0
            },
            type: 'TRANSFER',
            status: 'SUCCESS',
            account: {
              address: coin.address.toString(this.network)
            },
            amount: {
              value: '-' + coin.value.toString(),
              currency: {
                symbol: pkg.unit.toUpperCase(),
                decimals: pkg.decimals,
                metadata: {
                  Issuer: pkg.organization
                }
              }
            },
            metadata: {
              asm: input.witness.toASM(),
              hex: input.witness.toHex()
            }
          }
        );
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

      operations.push(
        {
          operation_identifier: {
            index: operations.length,
            network_index: 0
          },
          type: 'TRANSFER',
          status: 'SUCCESS',
          account: {
            address: output.address.toString(this.network)
          },
          amount: {
            value: output.value.toString(),
            currency: {
              symbol: pkg.unit.toUpperCase(),
              decimals: pkg.decimals,
              metadata: {
                Issuer: pkg.organization
              }
            }
          },
          metadata: {}, // TODO: convenant?
        }
      );
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
    }
  }
}

module.exports = TX;
