/*!
 * blockmeta.js - blockmeta object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

class BlockMeta {
  constructor(height, hash) {
    this.height = height;
    this.hash = hash;
  }

  toJSON() {
    return {
      index: this.height,
      hash: this.hash.toString('hex')
    };
  }
}

module.exports = BlockMeta;
