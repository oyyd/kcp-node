# WORK

KCP pure nodejs implementation.

## Benchmark

- Why
  - Measure
- What
  - KCP
  - Encryption
  - Socket

## Phase 1

- Work with `http` modules
- kcp-node
  - udp session
- benchmark
  - benchmark with tcp
  - high connections benchmark
  - communicate with tcp-go

## Phase ideas

- ssjs bundle
- libuv bundle
- node cpp addon for the libuv bundle

## Some idea

- api
  - we follow the api design of kcp as it's pretty elegant
- All implementations by scripts are nearly impossible to be faster than tcp.
  - need experiments

## Principle

- This repo will keep sync with kcp

## Question

- kcp->cwnd is zero if the `nc` is not set. Therefore no packets will be sended.
- default `sn` 0 indicate that the first segment will always be received
- kcp.xmit never used
- Encryption is how kcp-go refuses unauthorized connections so that we must use one in real world.
