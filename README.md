# hrosetta

hrosetta is a [hsd][hsd] plugin for coinbase rosetta.

## Usage

Note: Temporarily we require a fork of hsd: https://github.com/tuxcanfly/hsd/tree/rosetta

## API Reference:

https://djr6hkgq2tjcs.cloudfront.net

## Testing

Install the rosetta-cli validator:

    $ go get github.com/coinbase/rosetta-cli

Run hsd (tuxcanfly/rosetta branch), along with `hrosetta` plugin:

    $ hsd --plugins hrosetta

Run quick check:

    $ rosetta-cli check:quick

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## License

Copyright (c) 2020, The Handshake Developers (MIT License)

See LICENSE for more info.

[hsd]: https://github.com/handshake-org/hsd
