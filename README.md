# kcp-node

[![Build Status](https://travis-ci.org/oyyd/kcp-node.svg?branch=master)](https://travis-ci.org/oyyd/kcp-node)
[![Coverage Status](https://coveralls.io/repos/github/oyyd/kcp-node/badge.svg?branch=master)](https://coveralls.io/github/oyyd/kcp-node?branch=master)

## Features / Main Dependencies

- Performance -> More native Modules (the frequency of gc is the critial factor for node)

## Environment

node 6+

## Install

## Usage

## Protocol

### KCP

```
+------+-----+-----+-----+----+----+-----+-----+
| CONV | CMD | FRG | WND | TS | SN | UNA | LEN |
+------+-----+-----+-----+----+----+-----+-----+
|  4   |  1  |  1  |  2  | 4  | 4  |  4  |  4  |
+------+-----+-----+-----+----+----+-----+-----+
```

### KCP-GO Session Specification

```
+-----------------+---------------+---------------+-----+
| NONCE(optional) | CRC(optional) | FEC(optional) | KCP |
+-----------------+---------------+---------------+-----+
|     16          |      4        |       8       |     |
+-----------------+---------------+---------------+-----+
```

## Performance and Benchmark

## About Multiplexing

- Data that comes later have to wait previous data to be transmited.
- New data don't have to probe appropriate window size again.

## Unsigned Timestamp Manipulation

`getCurrent`

## Relatives

## LICENSE

MIT
