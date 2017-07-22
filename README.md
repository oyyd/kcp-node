# kcp-node

[![Build Status](https://travis-ci.org/oyyd/kcp-node.svg?branch=master)](https://travis-ci.org/oyyd/kcp-node)

- env > node 6
- test coverage

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
