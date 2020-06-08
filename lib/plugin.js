/*!
 * plugin.js - rosetta plugin for hsd
 * Copyright (c) 2020, The Handshake Developers.
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('bsert');
const HTTP = require('./http');
const pkg = require('./pkg');

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
    this.config = node.config.filter(pkg.core);
    this.config.open(`${pkg.core}.conf`);

    this.http = new HTTP({
      network: node.network,
      logger: node.logger,
      node: node,
      prefix: this.config.prefix,
      ssl: this.config.bool('ssl'),
      keyFile: this.config.path('ssl-key'),
      certFile: this.config.path('ssl-cert'),
      host: this.config.str('http-host'),
      port: this.config.uint('http-port'),
      apiKey: this.config.str('api-key'),
      noAuth: this.config.bool('no-auth'),
      cors: this.config.bool('cors')
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

plugin.id = pkg.name;

/**
 * Plugin initialization.
 * @param {Node} node
 * @returns {Plugin}
 */

plugin.init = function init(node) {
  return new Plugin(node);
};
