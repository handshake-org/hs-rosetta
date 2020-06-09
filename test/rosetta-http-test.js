/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */

'use strict';

const assert = require('bsert');
const hsd = require('hsd');
const FullNode = hsd.FullNode;
const {Client} = require('bcurl');
const {NodeClient} = require('hs-client');
const network = hsd.Network.get('simnet');

const client = new Client({
  port: 8080
});

const node = new FullNode({
  network: network.toString(),
  memory: true,
  workers: true,
  indexTX: true,
  indexAddress: true,
  plugins: [require('../lib/plugin'), hsd.wallet.plugin]
});

const {wdb} = node.require('walletdb');

const nclient = new NodeClient({
  port: network.rpcPort,
  apiKey: 'foo'
});

let wallet = null;

const endpoints = [
  '/network/list',
  '/network/options',
  '/network/status',
  '/account/balance',
  '/block',
  '/block/transaction',
  '/construction/metadata',
  '/mempool'
];

describe('Rosetta Schema', function() {
  this.timeout(15000);

  it('should open node', async () => {
    await node.open();
    await client.open();
  });

  for (const endpoint of endpoints) {
    it(`should match POST response for ${endpoint}`, async () => {
      const params = require(`./data${endpoint}/request.json`);
      const expected = require(`./data${endpoint}/response.json`);
      const data = await client.post(endpoint, params);
      assert.deepEqual(data, expected);
    });
  }

  {
    let tx, cbAddress, toAddress, changeAddress = null;
    it('should mine 100 blocks', async () => {
      wallet = await wdb.create();
      cbAddress = await wallet.receiveAddress();
      await mineBlocks(100, cbAddress.toString(network));
    });

    it('should match POST response for /construction/submit', async () => {
      toAddress = await wallet.receiveAddress();
      changeAddress = await wallet.changeAddress();
      const mtx = await wallet.createTX({
        rate: 100000,
        outputs: [{
          value: 100000,
          address: toAddress
        }],
        changeAddress: changeAddress
      });

      await wallet.sign(mtx);
      assert(mtx.isSigned());
      tx = mtx.toTX();
      await wdb.addTX(tx);

      const endpoint = '/construction/submit';
      const params = require(`./data${endpoint}/request.json`);
      params.signed_transaction = tx.toRaw().toString('hex');

      const expected = require(`./data${endpoint}/response.json`);
      const data = await client.post(endpoint, params);
      expected.transaction_identifier.hash = tx.hash().toString('hex');

      assert.deepEqual(data, expected);
    });

    it('should match POST response for /mempool/transaction', async () => {
      await sleep(500);
      const endpoint = '/mempool/transaction';
      const params = require(`./data${endpoint}/request.json`);
      params.transaction_identifier.hash = tx.hash().toString('hex');

      const expected = require(`./data${endpoint}/response.json`);
      const data = await client.post(endpoint, params);

      expected.transaction.transaction_identifier.hash = tx.hash().toString('hex');
      expected.transaction.operations[0].account.address = cbAddress.toString(network);
      expected.transaction.operations[1].account.address = toAddress.toString(network);
      expected.transaction.operations[2].account.address = changeAddress.toString(network);

      expected.transaction.operations[0].metadata.asm = tx.inputs[0].witness.toASM();
      expected.transaction.operations[0].metadata.hex = tx.inputs[0].witness.toHex();

      assert.deepEqual(data, expected);
    });
  }

  it('should cleanup', async () => {
    await node.close();
    await client.close();
  });
});

// take into account race conditions
async function mineBlocks(count, address) {
  for (let i = 0; i < count; i++) {
    const obj = { complete: false };
    node.once('block', () => {
      obj.complete = true;
    });
    await nclient.execute('generatetoaddress', [1, address]);
    await forValue(obj, 'complete', true);
  }
}

async function forValue(obj, key, val, timeout = 30000) {
  assert(typeof obj === 'object');
  assert(typeof key === 'string');

  const ms = 10;
  let interval = null;
  let count = 0;

  return new Promise((resolve, reject) => {
    interval = setInterval(() => {
      if (obj[key] === val) {
        clearInterval(interval);
        resolve();
      } else if (count * ms >= timeout) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for value.'));
      }
      count += 1;
    }, ms);
  });
};

async function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}
