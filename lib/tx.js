const pkg = require('./pkg');


class TX {
  constructor(tx, view, network) {
    this.tx = tx;
    this.view = view;
    this.network = network;
  }

  operations() {
    const operations = [];
    for (const output of this.tx.outputs) {
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
          }
        }
      );
    }

    if (!this.tx.isCoinbase()) {
      for (const input of this.tx.inputs) {
        const coin = this.view.getCoinFor(input);
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

    return operations;
  }

  toJSON() {
    return {
      transaction: {
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
}

module.exports = TX;
