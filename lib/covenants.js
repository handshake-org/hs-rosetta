/*!
 * covenants.js - covenant object for rosetta.
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hs-rosetta
 */

'use strict';

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

module.exports = CovenantTypes;
