import {
  IKCP_CMD_ACK,
  IKCP_OVERHEAD,
  createSegment,
} from './create'

// @private
export function output(kcp, buffer) {
  if (buffer.length === 0) {
    return 0
  }

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
export function flush(kcp) {
  // TODO: the allection is expensive especially when there is too many conenctions
  // TODO: make sure the allocation is correct
  // TODO: reassign a buffer at the end of flush
  const { buffer, current } = kcp
  const seg = createSegment()

  if (kcp.updated === 0) {
    return
  }

  seg.conv = kcp.conv
  seg.cmd = IKCP_CMD_ACK
  seg.frg = 0
  seg.wnd = kcp.nrcv_que < kcp.rcv_wnd ? kcp.rcv_wnd - kcp.nrcv_que : 0
  seg.una = kcp.rcv_nxt
  seg.len = 0
  seg.sn = 0
  seg.ts = 0

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
