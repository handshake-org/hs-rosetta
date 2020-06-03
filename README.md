# hs-rosetta

hs-rosetta is a [hsd][hsd] plugin for coinbase rosetta.

## Usage

    hsd --plugins hs-rosetta --index-tx --index-address

requires `--index-tx` `--index-address` for reporting account balances.

## Reference

https://djr6hkgq2tjcs.cloudfront.net

NOTE: We do not support address balance by height yet. According to the spec,
this is optional.

## Testing

Install the rosetta-cli validator:

    $ go get github.com/coinbase/rosetta-cli

Install hsd, hs-rosetta:

    $ npm install hsd hs-rosetta

Sync mainnet:

    $ hsd --plugins hs-rosetta --index-tx --index-address

Run check (`--lookup-balance-by-block=false` is required):

    $ rosetta-cli check --lookup-balance-by-block=false

Should start syncing:

    >>Adding block &{Index:17819 Hash:00000000000002146e6df64bc47a06b89e936b5e4f5349e3ffbaab27e4439644}

When successful, it should sync to the tip and sleep:

    2020/06/03 17:17:38 Syncer at tip 17820...sleeping

If it fails, you might see `Reconciliation failed` or similar error. Please
report it.

## Development

Link hs-rosetta:

    $ git clone https://github.com/tuxcanfly/hs-rosetta

    $ cd hs-rosetta

    $ npm link

    $ cd hsd

    $ npm link hs-rosetta

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## License

Copyright (c) 2020, The Handshake Developers (MIT License)

See LICENSE for more info.

[hsd]: https://github.com/handshake-org/hsd
