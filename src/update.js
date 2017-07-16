export function flush() {}

// @private
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

export function update() {}
