# WORK

KCP pure nodejs implementation.

- kcp-node
- kcptun(udp)
- ssjs bundle

- benchmark with tcp
- high connections benchmark
- communicate with tcp-go
- api
  - we follow the api design of kcp as it's pretty elegant
  - but
- All implementations by scripts are nearly impossible to be faster than tcp.
  - need experiments

## Principle

- This repo will keep sync with kcp

## Question

- kcp->cwnd is zero if the `nc` is not set. Therefore no packets will be sended.

## Relative repos

- libuv bundle
- node cpp addon for the libuv bundle
