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

Run hsd, along with `hs-rosetta` plugin:

    $ hsd --plugins hs-rosetta

Verify the hs-rosetta HTTP server is up:

    curl -X POST http://localhost:8080/network/status

Run quick check:

    $ rosetta-cli check

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## License

Copyright (c) 2020, The Handshake Developers (MIT License)

See LICENSE for more info.

[hsd]: https://github.com/handshake-org/hsd
