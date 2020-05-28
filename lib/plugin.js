/*!
 * plugin.js - rosetta plugin for hsd
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('bsert');
const HTTP = require('./http');

/**
 * @exports plugin
 */

const plugin = exports;

/**
 * Plugin
 * @extends Index
 */

class Plugin {
  /**
   * Create a plugin.
   * @constructor
   * @param {Node} node
   */

  constructor(node) {
    this.opened = false;
    this.logger = node.logger;

    this.http = new HTTP({
      logger: node.logger,
      node: node
    });
  }

  /**
   * Open the plugin.
   * @returns {Promise}
   */

  async open() {
    assert(!this.opened, 'plugin is already open.');
    this.opened = true;

    await this.http.open();
  }

  /**
   * Close the plugin.
   * @returns {Promise}
   */

  async close() {
    assert(this.opened, 'plugin is not open.');
    this.opened = false;

    await this.http.close();
  }
}

/**
 * Plugin name.
 * @const {String}
 */

plugin.id = 'hs-rosetta';

/**
 * Plugin initialization.
 * @param {Node} node
 * @returns {Plugin}
 */

plugin.init = function init(node) {
  return new Plugin(node);
};
