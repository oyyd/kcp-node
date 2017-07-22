# WORK

KCP pure nodejs implementation.

- kcp-node
- kcptun(udp)
- ssjs bundle

- api
  - we follow the api design of kcp as it's pretty elegant
  - but
- All implementations by scripts are nearly impossible to be faster than tcp.
  - need experiments

## Question

- kcp->cwnd is zero if the `nc` is not set. Therefore no packets will be sended.
