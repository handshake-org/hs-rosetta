/*!
 * util.js - util for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

const CovenantTypes = require('./covenant');

function isUnspendable(covenant) {
  // REGISTER->REVOKE covenants have no effect.
  if (covenant.type >= CovenantTypes.REGISTER
    && covenant.type <= CovenantTypes.REVOKE) {
    return true;
  }
  return false;
}

exports.isUnspendable = isUnspendable;
