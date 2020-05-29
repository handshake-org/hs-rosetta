/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */

'use strict';

const assert = require('bsert');
const hsd = require('hsd');
const FullNode = hsd.FullNode;
const {Client} = require('bcurl');

const client = new Client({
  port: 8080
});

const node = new FullNode({
  network: 'simnet',
  memory: true,
  workers: true,
  indexTX: true,
  indexAddress: true,
  plugins: [require('../lib/plugin')]
});

const endpoints = [
  '/network/list',
  '/network/options',
  '/network/status',
  '/account/balance',
  '/block',
  '/block/transaction',
  '/construction/metadata',
  '/construction/submit',
  '/mempool',
  //'/mempool/transaction'
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

  it('should cleanup', async () => {
    await node.close();
    await client.close();
  });
});
