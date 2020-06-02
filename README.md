# hs-rosetta

hs-rosetta is a [hsd][hsd] plugin for coinbase rosetta.

## Usage

Note: Temporarily we require a minor fork of hsd: https://github.com/tuxcanfly/hsd/tree/rosetta

## API Reference:

https://djr6hkgq2tjcs.cloudfront.net

## Testing

Install the rosetta-cli validator:

    $ go get github.com/coinbase/rosetta-cli

Link hs-rosetta:

    $ git clone https://github.com/tuxcanfly/hs-rosetta

    $ cd hs-rosetta

    $ npm link

    $ git clone https://github.com/tuxcanfly/hsd/tree/rosetta

    $ cd hsd

    $ npm link hs-rosetta

Sync mainnet:

    $ hsd --plugins hs-rosetta --index-tx --index-address

Run check:

    $ rosetta-cli check

Should start syncing:

    >>2020/06/03 00:19:37 Adding block &{Index:2780 Hash:00000000000006105d6970a3c1a2c0b8ebee6f4597a3830eb80bb77062f42c7d}

Should exit gracefully after syncing to tip. If it fails, you might see
"Reconciliation failed" or similar error. Please report it.

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## License

Copyright (c) 2020, The Handshake Developers (MIT License)

See LICENSE for more info.

[hsd]: https://github.com/handshake-org/hsd
