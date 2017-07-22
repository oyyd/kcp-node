# WORK

KCP pure nodejs implementation.

## Phase 1

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
