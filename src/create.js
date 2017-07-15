export const IKCP_RTO_NDL = 30
export const IKCP_RTO_MIN = 100
export const IKCP_RTO_DEF = 200
export const IKCP_RTO_MAX = 60000
export const IKCP_ASK_SEND = 1
export const IKCP_ASK_TELL = 2
export const IKCP_WND_SND = 32
export const IKCP_WND_RCV = 32
export const IKCP_MTU_DEF = 1400
export const IKCP_ACK_FAST = 3
export const IKCP_INTERVAL = 100
export const IKCP_DEADLINK = 20
export const IKCP_THRESH_INIT = 2
export const IKCP_THRESH_MIN = 2
export const IKCP_PROBE_INIT = 7000 // 7 secs to probe window size
export const IKCP_PROBE_LIMIT = 120000 // up to 120 secs to probe window
export const IKCP_OVERHEAD = 24
export const IKCP_CMD_PUSH = 81
export const IKCP_CMD_ACK = 82
export const IKCP_CMD_WASK = 83
export const IKCP_CMD_WINS = 84

// @private
export const DEFAULT_KCPCB = {
  conv: null,
  user: null,
  snd_una: 0,
  snd_nxt: 0,
  rcv_nxt: 0,
  ts_probe: 0,
  probe_wait: 0,
  snd_wnd: IKCP_WND_SND,
  rcv_wnd: IKCP_WND_RCV,
  rmt_wnd: IKCP_WND_RCV,
  cwnd: 0,
  incr: 0,
  probe: 0,
  mtu: IKCP_MTU_DEF,
  stream: 0,
  mss: IKCP_MTU_DEF - IKCP_OVERHEAD,
  // TODO:
  buffer: null,
  snd_queue: null,
  rcv_queue: null,
  snd_buf: null,
  rcv_buf: null,
  nrcv_buf: 0,
  nsnd_buf: 0,
  nrcv_que: 0,
  nsnd_que: 0,
  state: 0,
  acklist: null,
  ackblock: 0,
  ackcount: 0,
  rx_srtt: 0,
  rx_rttval: 0,
  rx_rto: IKCP_RTO_DEF,
  rx_minrto: IKCP_RTO_MIN,
  current: 0,
  interval: IKCP_INTERVAL,
  ts_flush: IKCP_INTERVAL,
  nodelay: 0,
  updated: 0,
  logmask: 0,
  ssthresh: IKCP_THRESH_INIT,
  fastresend: 0,
  nocwnd: 0,
  xmit: 0,
  dead_link: IKCP_DEADLINK,
  output: null,
  writelog: null,
}

// TODO: maybe we don't need `user`
export function create(conv, user) {
  const instance = Object.assign({
    conv,
    user,
  }, DEFAULT_KCPCB)

  return instance
}

export function createSegment() {
  return {
    conv: 0,
    cmd: 0,
    frg: 0,
    wnd: 0,
    ts: 0,
    sn: 0,
    una: 0,
    len: 0,
    resendts: 0,
    rto: 0,
    fastack: 0,
    xmit: 0,
    data: null,
  }
}

export function setMtu(kcp, mtu) {
  if (mtu < 50 || mtu < IKCP_OVERHEAD) {
    return -1
  }

  kcp.mtu = mtu
  kcp.mss = kcp.mtu - IKCP_OVERHEAD

  return 0
}
