import {
  IKCP_THRESH_MIN,
  IKCP_CMD_PUSH,
  IKCP_ASK_TELL,
  IKCP_CMD_WINS,
  IKCP_CMD_WASK,
  IKCP_ASK_SEND,
  IKCP_PROBE_LIMIT,
  IKCP_PROBE_INIT,
  IKCP_CMD_ACK,
  IKCP_OVERHEAD,
  createSegment,
} from './create'
// import { isEmpty } from './utils'

// @private
export function output(kcp, buffer) {
  if (buffer.length === 0) {
    return 0
  }

  kcp.output(buffer, kcp, kcp.user)
  return 0
}

// @private
export function createSegBuf(seg) {
  const buffer = Buffer.allocUnsafe(IKCP_OVERHEAD)
  buffer.writeUInt32BE(seg.conv, 0)
  buffer.writeUInt8(seg.cmd, 4)
  buffer.writeUInt8(seg.frg, 5)
  buffer.writeUInt16BE(seg.wnd, 6)
  buffer.writeUInt32BE(seg.ts, 8)
  buffer.writeUInt32BE(seg.sn, 12)
  buffer.writeUInt32BE(seg.una, 16)
  buffer.writeUInt32BE(seg.len, 20)

  return buffer
}

// @private
export function outputAcks(kcp, seg) {
  let buffer = kcp.buffer

  const count = kcp.ackcount
  let i = 0

  for (; i < count; i += 1) {
    if (buffer.length + IKCP_OVERHEAD > kcp.mtu) {
      output(kcp, buffer)
      buffer = Buffer.allocUnsafe(0)
    }

    seg.sn = kcp.acklist[i * 2]
    seg.ts = kcp.acklist[i * 2 + 1]

    buffer = Buffer.concat([buffer, createSegBuf(seg)])
  }

  kcp.ackcount = 0

  kcp.buffer = buffer
}

// @private
export function setProbe(kcp) {
  // if don't know remote window
  if (kcp.rmt_wnd === 0) {
    // if no valid probe wait time
    if (kcp.probe_wait === 0) {
      kcp.probe_wait = IKCP_PROBE_INIT
      // set prove time
      kcp.ts_probe = kcp.current + kcp.probe_wait
      // if current time is over the time to probe
    } else if (kcp.current >= kcp.ts_probe) {
      if (kcp.probe_wait < IKCP_PROBE_INIT) kcp.probe_wait = IKCP_PROBE_INIT
      // wait time * 1.5
      kcp.probe_wait += kcp.probe_wait / 2
      if (kcp.probe_wait > IKCP_PROBE_LIMIT) kcp.probe_wait = IKCP_PROBE_LIMIT
      // set wait time again
      kcp.ts_probe = kcp.current + kcp.probe_wait
      kcp.probe |= IKCP_ASK_SEND
    }
    // know remote window
  } else {
    kcp.ts_probe = 0
    kcp.probe_wait = 0
  }
}

// @private
export function outputProbe(kcp, seg, flag, cmd) {
  let { buffer } = kcp

  if (kcp.probe & flag) {
    seg.cmd = cmd
    if (buffer.length + IKCP_OVERHEAD > kcp.mtu) {
      output(kcp, buffer)
      buffer = Buffer.allocUnsafe(0)
    }

    buffer = Buffer.concat([buffer, createSegBuf(seg)])
  }

  kcp.buffer = buffer
}

// @private
export function putQueueToBuf(kcp, cwnd) {
  // NOTE: put data from snd_queue to snd_buf
  // and then send them
  const rest = kcp.snd_una + cwnd - kcp.snd_nxt
  // console.log('rest', kcp.user, `rest: ${rest} = snd_una: ${kcp.snd_una}
  // + cwnd: ${cwnd} - snd_nxt: ${kcp.snd_nxt}`)

  if (rest <= 0) {
    return
  }

  const size = Math.min(rest, kcp.nsnd_que)

  for (let i = 0; i < size; i += 1) {
    const seg = kcp.snd_queue[i]

    seg.conv = kcp.conv
    seg.cmd = IKCP_CMD_PUSH
    seg.wnd = seg.wnd
    seg.ts = kcp.current
    // where `sn` decided
    seg.sn = kcp.snd_nxt + i

    seg.una = kcp.rcv_nxt
    seg.resendts = kcp.current
    seg.rto = kcp.rx_rto
    seg.fastack = 0
    seg.xmit = 0

    kcp.snd_buf.push(seg)
  }

  kcp.snd_queue.splice(0, size)
  kcp.snd_nxt += size
  kcp.nsnd_que -= size
  kcp.nsnd_buf += size
}

// @private
export function outputBuf(kcp, wnd, rtomin, resent) {
  const { current } = kcp
  let { buffer } = kcp

  const length = kcp.snd_buf.length
  let lost = 0
  let change = 0

  for (let i = 0; i < length; i += 1) {
    const segment = kcp.snd_buf[i]
    let needsend = 0

    if (segment.xmit === 0) {
      needsend = 1
      segment.xmit += 1
      segment.rto = kcp.rx_rto
      // NOTE: we don't plus rtomin if xmit is not 0
      segment.resendts = current + segment.rto + rtomin
    } else if (current >= segment.resendts) {
      needsend = 1
      segment.xmit += 1
      // NOTE: kcp.xmit is never used inside
      kcp.xmit += 1
      // NOTE: this is different from how it's explained
      if (kcp.nodelay === 0) {
        segment.rto += kcp.rx_rto
      } else {
        segment.rto += kcp.rx_rto / 2
      }

      segment.resendts = current + segment.rto
      lost = 1
    // resend if it's missed too many times
    } else if (segment.fastack >= resent) {
      needsend = 1
      segment.xmit += 1
      segment.fastack = 0
      segment.resendts = current + segment.rto
      change += 1
    }

    if (needsend) {
      segment.ts = current
      segment.wnd = wnd
      segment.una = kcp.rcv_nxt

      const need = IKCP_OVERHEAD + segment.len

      if (buffer.length + need > kcp.mtu) {
        output(kcp, buffer)
        buffer = Buffer.allocUnsafe(0)
      }

      buffer = Buffer.concat([buffer, createSegBuf(segment)])

      if (segment.len > 0) {
        buffer = Buffer.concat([buffer, segment.data])
      }

      if (segment.xmit >= kcp.dead_link) {
        // NOTE: check state to assert the
        // activation of a session
        kcp.state = -1
      }
    }
  }

  return { lost, change }
}

// @private
export function setCwnd(kcp, change, lost, cwnd, resent) {
  // fastacked
  if (change) {
    const inflight = kcp.snd_nxt - kcp.snd_una
    kcp.ssthresh = Math.floor(inflight / 2)

    if (kcp.ssthresh < IKCP_THRESH_MIN) {
      kcp.ssthresh = IKCP_THRESH_MIN
    }

    kcp.cwnd = kcp.ssthresh + resent
    // NOTE: incr is not used inside
    kcp.incr = kcp.cwnd * kcp.mss
  }

  if (lost) {
    kcp.ssthresh = Math.floor(cwnd / 2)

    if (kcp.ssthresh < IKCP_THRESH_MIN) {
      kcp.ssthresh = IKCP_THRESH_MIN
    }

    kcp.cwnd = 1
    kcp.incr = kcp.mss
  }

  if (kcp.cwnd < 1) {
    kcp.cwnd = 1
    kcp.incr = kcp.mss
  }
}

// @private
export function flush(kcp) {
  if (kcp.updated === 0) {
    return
  }

  const seg = createSegment()
  kcp.buffer = Buffer.allocUnsafe(0)

  seg.conv = kcp.conv
  seg.cmd = IKCP_CMD_ACK
  seg.frg = 0
  seg.wnd = kcp.nrcv_que < kcp.rcv_wnd ? kcp.rcv_wnd - kcp.nrcv_que : 0
  seg.una = kcp.rcv_nxt
  seg.len = 0
  seg.sn = 0
  seg.ts = 0

  outputAcks(kcp, seg)

  setProbe(kcp)

  outputProbe(kcp, seg, IKCP_ASK_SEND, IKCP_CMD_WASK)
  outputProbe(kcp, seg, IKCP_ASK_TELL, IKCP_CMD_WINS)

  kcp.probe = 0

  let cwnd = Math.min(kcp.snd_wnd, kcp.rmt_wnd)

  // do not controlled by the tcp cwnd
  if (kcp.nocwnd === 0) {
    cwnd = Math.min(kcp.cwnd, cwnd)
  }

  putQueueToBuf(kcp, cwnd)

  const resent = kcp.fastresend > 0 ? kcp.fastresend : Infinity
  const rtomin = kcp.nodelay === 0 ? kcp.rx_rto >> 3 : 0

  const res = outputBuf(kcp, seg.wnd, rtomin, resent)
  const { lost, change } = res

  if (kcp.buffer.length > 0) {
    output(kcp, kcp.buffer)
  }

  setCwnd(kcp, change, lost, cwnd, resent)
}

export function check(kcp, current) {
  let { ts_flush } = kcp
  let tm_flush = 0x7fffffff
  let tm_packet = 0x7fffffff
  let minimal = 0

  if (kcp.updated === 0) {
    return current
  }

  if (Math.abs(current - ts_flush) >= 10000) {
    ts_flush = current
  }

  if (current - ts_flush >= 0) {
    return current
  }

  tm_flush = ts_flush - current

  for (let i = 0; i < kcp.snd_buf.length; i += 1) {
    const seg = kcp.snd_buf[i]
    const diff = seg.resendts - current

    if (diff <= 0) {
      return current
    }

    if (diff < tm_packet) {
      tm_packet = diff
    }
  }

  minimal = Math.min(tm_packet, tm_flush)

  if (minimal >= kcp.interval) {
    minimal = kcp.interval
  }

  return current + minimal
}

// @private
export function updateAndFlush(kcp, current, next) {
  let slap
  kcp.current = current

  if (kcp.updated === 0) {
    kcp.updated = 1
    kcp.ts_flush = kcp.current
  }

  slap = kcp.current - kcp.ts_flush

  if (Math.abs(slap) >= 10000) {
    slap = 0
  }

  if (slap >= 0) {
    // console.log('slap', kcp.ts_flush)
    // next flush time
    kcp.ts_flush += kcp.interval

    // if it's still earlier than current
    if (kcp.current - kcp.ts_flush >= 0) {
      kcp.ts_flush = kcp.current + kcp.interval
    }

    next(kcp)
  }
}

export function update(kcp, current) {
  return updateAndFlush(kcp, current, flush)
}
