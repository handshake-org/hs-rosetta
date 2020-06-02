/*!
 * pkg.js - package constants
 * Copyright (c) 2020, The Handshake Developers (MIT License).
 * https://github.com/handshake-org/hsd
 */

'use strict';

const pkg = exports;

/**
 * Package Name
 * @const {String}
 * @default
 */

pkg.name = 'hs-rosetta';

/**
 * Project Name
 * @const {String}
 * @default
 */

pkg.core = 'hsd';

/**
 * Organization Name
 * @const {String}
 * @default
 */

pkg.organization = 'handshake-org';

/**
 * Blockchain Name
 * @const {String}
 * @default
 */

pkg.blockchain = 'handshake';

/**
 * Currency Name
 * @const {String}
 * @default
 */

pkg.currency = 'handshake';

/**
 * Currency Unit
 * @const {String}
 * @default
 */

pkg.unit = 'hns';

/**
 * Base Unit (dollarydoos!)
 * @const {String}
 * @default
 */

pkg.base = 'doo';

/**
 * Decimals
 * @const {String}
 * @default
 */

pkg.decimals = 8;

/**
 * Config file name.
 * @const {String}
 * @default
 */

pkg.cfg = `${pkg.core}.conf`;

/**
 * Current version string.
 * @const {String}
 * @default
 */

pkg.version = '0.0.1';

/**
 * Repository URL.
 * @const {String}
 * @default
 */

pkg.url = `https://github.com/${pkg.organization}/${pkg.name}`;

/**
 * Rosetta version
 * @const {String}
 * @default
 */

pkg.rosetta = '1.3.1';

