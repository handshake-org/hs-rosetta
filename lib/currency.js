'use strict';

const pkg = require('./pkg');

class Currency {
  toJSON() {
    return {
      symbol: pkg.unit.toUpperCase(),
      decimals: pkg.decimals,
      metadata: {
        Issuer: pkg.organization
      }
    };
  }
}

// Singleton
const currency = new Currency();

module.exports = currency;
