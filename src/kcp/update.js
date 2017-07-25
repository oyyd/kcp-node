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

  // TODO: should copy buffer here
  // NOTE: the output api is different
  kcp.output(buffer, kcp, kcp.user)
  return 0
}

// @private
export function encodeSeg(buffer, offset, seg) {
  buffer.writeInt32BE(seg.conv, offset + 0)
  buffer.writeInt8(seg.cmd, offset + 4)
  buffer.writeInt8(seg.frg, offset + 5)
  buffer.writeInt16BE(seg.wnd, offset + 6)
  buffer.writeInt32BE(seg.ts, offset + 8)
  buffer.writeInt32BE(seg.sn, offset + 12)
  buffer.writeInt32BE(seg.una, offset + 16)
  buffer.writeInt32BE(seg.len, offset + 20)
}

// @private
export function outputAcks(kcp, seg) {
  const { buffer } = kcp

  const count = kcp.ackcount
  let i = 0
  // TODO: offset may should not start with 0
  let offset = 0

  for (; i < count; i += 1) {
    if (offset + IKCP_OVERHEAD > kcp.mtu) {
      // TODO: `output` shoud consume the buffer as it will be rewrite
      output(kcp, buffer.slice(0, offset))
      offset = 0
    }

    seg.sn = kcp.acklist[i * 2]
    seg.ts = kcp.acklist[i * 2 + 1]

    encodeSeg(buffer, offset, seg)
    offset += IKCP_OVERHEAD
  }

  kcp.ackcount = 0

  return offset
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
export function outputProbe(kcp, seg, offset, flag, cmd) {
  const { buffer } = kcp

  if (kcp.probe & flag) {
    seg.cmd = cmd
    if (offset + IKCP_OVERHEAD > kcp.mtu) {
      output(kcp, buffer.slice(0, offset))
      offset = 0
    }

    encodeSeg(buffer, offset, seg)
    offset += IKCP_OVERHEAD
  }

  return offset
}

// @private
export function putQueueToBuf(kcp, cwnd) {
  // TODO: test
  // TODO: we somehow put data from snd_queue
  // to snd_buf
  const rest = kcp.snd_una + cwnd - kcp.snd_nxt
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
export function outputBuf(kcp, wnd, offset, rtomin, resent) {
  const { current, buffer } = kcp
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
      // TODO: why rotmin?
      segment.resendts = current + segment.rto + rtomin
    } else if (current >= segment.resendts) {
      needsend = 1
      segment.xmit += 1
      kcp.xmit += 1

      // TODO: this is different from how it explained
      if (kcp.nodelay === 0) {
        segment.rto += kcp.rx_rto
      } else {
        segment.rto += kcp.rx_rto / 2
      }

      segment.resendts = current + segment.rto
      lost = 1
    } else if (segment.fastack >= resent) {
      // TODO: make it more clear
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

      if (offset + need > kcp.mtu) {
        output(kcp, buffer.slice(0, offset))
        offset = 0
      }

      encodeSeg(buffer, offset, segment)
      offset += IKCP_OVERHEAD

      if (segment.len > 0) {
        segment.data.copy(buffer, offset, 0, segment.len)
        offset += segment.len
      }

      if (segment.xmit >= kcp.dead_link) {
        // TODO: for what
        kcp.state = -1
      }
    }
  }

  return { offset, lost, change }
}

// @private
export function setCwnd(kcp, change, lost, cwnd, resent) {
  // fastacked
  if (change) {
    const inflight = kcp.snd_nxt - kcp.snd_una
    kcp.ssthresh = Math.floor(inflight / 2)

    // TODO: ssthresh
    if (kcp.ssthresh < IKCP_THRESH_MIN) {
      kcp.ssthresh = IKCP_THRESH_MIN
    }

    kcp.cwnd = kcp.ssthresh + resent
    // TODO: where to use incr?
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
  // TODO: the allection is expensive especially when there is too many conenctions
  // TODO: make sure the allocation is correct
  // TODO: reassign a buffer at the end of flush
  if (kcp.updated === 0) {
    return
  }

  const seg = createSegment()

  seg.conv = kcp.conv
  seg.cmd = IKCP_CMD_ACK
  seg.frg = 0
  seg.wnd = kcp.nrcv_que < kcp.rcv_wnd ? kcp.rcv_wnd - kcp.nrcv_que : 0
  seg.una = kcp.rcv_nxt
  seg.len = 0
  seg.sn = 0
  seg.ts = 0

  let offset = 0

  offset = outputAcks(kcp, seg)

  setProbe(kcp)

  offset = outputProbe(kcp, seg, offset, IKCP_ASK_SEND, IKCP_CMD_WASK)
  offset = outputProbe(kcp, seg, offset, IKCP_ASK_TELL, IKCP_CMD_WINS)

  kcp.probe = 0

  let cwnd = Math.min(kcp.snd_wnd, kcp.rmt_wnd)

  if (kcp.nocwnd === 0) {
    // TODO: why cwnd?
    cwnd = Math.min(kcp.cwnd, cwnd)
  }

  putQueueToBuf(kcp, cwnd)

  // TODO: nowhere to set fastresend
  const resent = kcp.fastresend > 0 ? kcp.fastresend : Infinity
  const rtomin = kcp.nodelay === 0 ? kcp.rx_rto >> 3 : 0

  const res = outputBuf(kcp, seg.wnd, offset, rtomin, resent)
  const { lost, change } = res
  offset = res.offset

  if (offset > 0) {
    output(kcp, kcp.buffer.slice(0, offset))
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
