class Prev {
  constructor(height, block) {
    this.height = height;
    this.block = block;
    this.hash = block.hash().toString('hex');
  }

  toJSON() {
    return {
      index: this.height,
      hash: this.hash
    }
  }
}

module.exports = Prev;
