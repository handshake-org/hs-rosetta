/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */

'use strict';

const assert = require('assert');

const Chain = require('bcoin').Chain;
const Address = require('bcoin').primitives.Address;
const Input = require('bcoin').primitives.Input;
const Outpoint = require('bcoin').primitives.Outpoint;
const MTX = require('bcoin').primitives.MTX;
const hash256 = require('bcrypto/lib/hash256');
const IndexDB = require('../lib/indexdb');
const random = require('bcrypto/lib/random');

function dummyInput() {
  const hash = random.randomBytes(32).toString('hex');
  return Input.fromOutpoint(new Outpoint(hash, 0));
}

const t1 = new MTX();
const addr1 = Address.fromString('mm4iDdGaeGRrAHLyMRw9wKQ5AHPubfQJb9');
t1.addInput(dummyInput());
t1.addOutput(addr1, 50000);
t1.addOutput(addr1, 1000);

function fromU32(num) {
  const data = Buffer.allocUnsafe(4);
  data.writeUInt32LE(num, 0, true);
  return data;
}

function fakeEntry(height) {
  const hash = hash256.digest(fromU32(height >>> 0));
  return {
    hash: hash.toString('hex'),
    height: height
  }
}

function fakeBlock(height) {
  const prev = hash256.digest(fromU32((height - 1) >>> 0));
  const hash = hash256.digest(fromU32(height >>> 0));
  const root = hash256.digest(fromU32((height | 0x80000000) >>> 0));

  return {
    hash: hash.toString('hex'),
    prevBlock: prev.toString('hex'),
    merkleRoot: root.toString('hex'),
    time: 500000000 + (height * (10 * 60)),
    bits: 0,
    nonce: 0,
    height: height,
    txs: [t1]
  };
}

function fakeCoinView(height) {
  return {};
}

function nextEntry(idb) {
  return fakeEntry(idb.tip.height + 1);
}

function nextBlock(idb) {
  return fakeBlock(idb.tip.height + 1);
}

function nextCoinView(idb) {
  return fakeCoinView(idb.tip.height + 1);
}

const chain = new Chain();
const options = {
  'memory': true,
  'network': 'simnet',
  'chain': chain
};
const idb = new IndexDB(options);

describe('Index', function() {
  this.timeout(5000);

  it('should open indexdb', async () => {
    await idb.open();
  });

  it('should index block', async () => {
    const entry = nextEntry(idb);
    const block = nextBlock(idb);
    const view = nextCoinView(idb);
    await idb.indexBlock(entry, block, view);
  });

  it('should unindex block', async () => {
    const entry = nextEntry(idb);
    const block = nextBlock(idb);
    const view = nextCoinView(idb);
    await idb.unindexBlock(entry, block, view);
  });

});
