const pkg = require('./pkg');
const TX = require('./tx');


class Block {
  constructor(height, block, view, prev, network) {
    this.height = height;
    this.block = block;
    this.view = view;
    this.prev = prev;
    this.network = network;
  }

  transactions() {
    const transactions = [];
    for (const transaction of this.block.txs) {
      const tx = new TX(transaction, this.view, this.network);
      transactions.push(tx.toJSON());
    }
    return transactions;
  }

  toJSON() {
    return {
      block: {
        block_identifier: {
          index: this.height,
          hash: this.block.hash().toString('hex')
        },
        parent_block_identifier: this.prev.toJSON(),
        timestamp: this.block.time * 1000,
        transactions: this.transactions(),
        metadata: {
          transactions_root: this.block.merkleRoot.toString('hex'),
          difficulty: toDifficulty(this.block.bits)
        }
      }
    }
  }
}


function toDifficulty(bits) {
  let shift = (bits >>> 24) & 0xff;
  let diff = 0x0000ffff / (bits & 0x00ffffff);

  while (shift < 29) {
    diff *= 256.0;
    shift++;
  }

  while (shift > 29) {
    diff /= 256.0;
    shift--;
  }

  return diff;
}

module.exports = Block;
