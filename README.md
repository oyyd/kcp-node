# kcp-node

[![Build Status](https://travis-ci.org/oyyd/kcp-node.svg?branch=master)](https://travis-ci.org/oyyd/kcp-node)
[![Coverage Status](https://coveralls.io/repos/github/oyyd/kcp-node/badge.svg?branch=master)](https://coveralls.io/github/oyyd/kcp-node?branch=master)

## Environment

- > `node 6`

## Protocol

```
+------+-----+-----+-----+----+----+-----+-----+
| CONV | CMD | FRG | WND | TS | SN | UNA | LEN |
+------+-----+-----+-----+----+----+-----+-----+
|  4   |  1  |  1  |  2  | 4  | 4  |  4  |  4  |
+------+-----+-----+-----+----+----+-----+-----+
```

## LICENSE

MIT
