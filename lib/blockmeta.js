class BlockMeta {
  constructor(height, hash) {
    this.height = height;
    this.hash = hash;
  }

  toJSON() {
    return {
      index: this.height,
      hash: this.hash.toString('hex')
    }
  }
}

module.exports = BlockMeta;
