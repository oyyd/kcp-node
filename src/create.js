const IKCP_RTO_NDL = 30
const IKCP_RTO_MIN = 100
const IKCP_RTO_DEF = 200
const IKCP_RTO_MAX = 60000
const IKCP_ASK_SEND = 1
const IKCP_ASK_TELL = 2
const IKCP_WND_SND = 32
const IKCP_WND_RCV = 32
const IKCP_MTU_DEF = 1400
const IKCP_ACK_FAST = 3
const IKCP_INTERVAL = 100
const IKCP_DEADLINK = 20
const IKCP_THRESH_INIT = 2
const IKCP_THRESH_MIN = 2
const IKCP_PROBE_INIT = 7000 // 7 secs to probe window size
const IKCP_PROBE_LIMIT = 120000 // up to 120 secs to probe window

export const IKCP_OVERHEAD = 24
export const IKCP_CMD_PUSH = 81
export const IKCP_CMD_ACK = 82
export const IKCP_CMD_WASK = 83
export const IKCP_CMD_WINS = 84

const DEFAULT_KCPCB = {
  // conv: null,
  // user: null,
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
