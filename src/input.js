import {
  IKCP_OVERHEAD,
  IKCP_CMD_PUSH,
  IKCP_CMD_ACK,
  IKCP_CMD_WASK,
  IKCP_CMD_WINS,
  IKCP_RTO_MAX,
  IKCP_ASK_TELL,
  createSegment,
} from './create'

export function parseUna(kcp, una) {
  const length = kcp.snd_buf.length
  let i = 0

  for (i = 0; i < length; i += 1) {
    if (kcp.snd_buf[i].sn >= una) {
      break
    }
  }

  if (i !== 0) {
    kcp.snd_buf = kcp.snd_buf.slice(i)
  }
}

export function shrinkBuf(kcp) {
  if (kcp.snd_buf.length > 0) {
    kcp.snd_una = kcp.snd_buf[0].sn
  } else {
    // TODO: what's snd_nxt
    kcp.snd_una = kcp.snd_nxt
  }
}

// NOTE: I'm confused with how the tcp calculates a new rto.
// TODO: check the rfc
// @private
export function updateAck(kcp, rtt) {
  let rto = 0

  // no value set
  if (kcp.rx_srtt === 0) {
    kcp.rx_srtt = rtt
    kcp.rx_rttval = rtt / 2
  } else {
    const delta = Math.abs(rtt - kcp.rx_srtt)

    kcp.rx_rttval = (3 * kcp.rx_rttval + delta) / 4
    kcp.rx_srtt = (7 * kcp.rx_srtt + rtt) / 8

    if (kcp.rx_srtt < 1) {
      kcp.rx_srtt = 1
    }
  }

  // `rx_rto` must be smaller than the `interval`
  rto = kcp.rx_srtt + Math.max(kcp.interval, kcp.rx_rttval * 4)
  kcp.rx_rto = Math.min(Math.max(kcp.rx_minrto, rto), IKCP_RTO_MAX)
}

// @private
export function parseAck(kcp, sn) {
  if (sn < kcp.snd_una || sn >= kcp.snd_nxt) {
    return
  }

  const { length } = kcp.snd_buf
  let cur = 0

  for (; cur !== length; cur += 1) {
    // NOTE: it's better to use link tables instead of arraies
    const seg = kcp.snd_buf[cur]

    if (sn === seg.sn) {
      kcp.snd_buf.splice(cur, 1)
      kcp.nsnd_buf -= 1
      break
    }

    if (sn < seg.sn) {
      break
    }
  }
}

// TODO: make sure the usage of acklist is correct
// @private
export function ackPush(kcp, sn, ts) {
  const newsize = kcp.ackcount + 1
  let newblock = 1

  if (newsize > kcp.ackblock) {
    for (; newblock < newsize; newblock *= 2);

    kcp.ackblock = newblock
  }

  kcp.acklist[kcp.ackcount * 2] = sn
  kcp.acklist[kcp.ackcount * 2 + 1] = ts
  kcp.ackcount = newsize
}

// @private
export function parseData(kcp, newseg) {
  const sn = newseg.sn
  let repeat = 0

  if (sn >= kcp.rcv_nxt + kcp.rcv_wnd || sn < kcp.rcv_nxt) {
    return
  }

  let i = kcp.rcv_buf.length - 1

  for (; i >= 0; i -= 1) {
    const seg = kcp.rcv_buf[i]

    if (seg.sn === sn) {
      repeat = 1
      break
    }

    if (sn > seg.sn) {
      break
    }
  }

  if (repeat === 0) {
    kcp.rcv_buf.splice(i + 1, 0, newseg)
    kcp.nrcv_buf += 1
  }

  const { length } = kcp.rcv_buf

  // NOTE: push values from the `rcv_buf` into the `rcv_queue`
  for (i = 0; i < length; i += 1) {
    const seg = kcp.rcv_buf[i]

    if (!(seg.sn === kcp.rcv_nxt + i && kcp.nrcv_que + i < kcp.rcv_wnd)) {
      break
    }
  }

  const trans = kcp.rcv_buf.splice(0, i)
  kcp.nrcv_buf -= i
  kcp.rcv_queue = kcp.rcv_queue.concat(trans)
  kcp.nrcv_que += i
  kcp.rcv_nxt += i
}

// @private
export function parseFastack(kcp, maxack) {

}

// @private
export function input(kcp, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < IKCP_OVERHEAD) {
    return -1
  }

  // TODO: test the size and the offset
  let size = buffer.length
  let offset = 0
  let flag = 0
  let maxack = 0

  while (offset < size) {
    if (size - offset < IKCP_OVERHEAD) {
      break
    }

    const conv = buffer.readUInt32BE(offset)

    if (conv !== kcp.conv) {
      return -1
    }

    const cmd = buffer.readUInt8BE(offset, 4)
    const frg = buffer.readUInt8BE(offset, 5)
    const wnd = buffer.readUInt16BE(offset, 6)
    const ts = buffer.readUInt32BE(offset, 8)
    const sn = buffer.readUInt32BE(offset, 12)
    const una = buffer.readUInt32BE(offset, 16)
    const len = buffer.readUInt32BE(offset, 20)

    size -= IKCP_OVERHEAD
    offset += IKCP_OVERHEAD

    if (size < len) {
      return -2
    }

    if (
      cmd !== IKCP_CMD_WINS &&
      cmd !== IKCP_CMD_WASK &&
      cmd !== IKCP_CMD_ACK &&
      cmd !== IKCP_CMD_PUSH
    ) {
      return -3
    }

    kcp.rmt_wnd = wnd
    parseUna(kcp, una)
    shrinkBuf(kcp)

    if (cmd === IKCP_CMD_ACK) {
      const delta = kcp.current - ts

      if (delta >= 0) {
        updateAck(kcp, delta)
      }

      parseAck(kcp, sn)
      shrinkBuf(kcp)

      if (flag === 0) {
        flag = 1
        maxack = sn
      } else if (sn > maxack) {
        maxack = sn
      }
    } else if (cmd === IKCP_CMD_PUSH) {
      if (sn < kcp.rcv_nxt + kcp.rcv_wnd) {
        ackPush(kcp, sn, ts)

        if (sn >= kcp.rcv_nxt) {
          const seg = createSegment()
          seg.conv = conv
          seg.cmd = cmd
          seg.frg = frg
          seg.wnd = wnd
          seg.ts = ts
          seg.sn = sn
          seg.una = una
          seg.len = len

          // TODO: check
          if (size > IKCP_OVERHEAD) {
            seg.data = buffer.slice(offset + IKCP_OVERHEAD, offset + IKCP_OVERHEAD + len)
          }

          parseData(kcp, seg)
        }
      }
    } else if (cmd === IKCP_CMD_WASK) {
      kcp.probe |= IKCP_ASK_TELL
    } else if (cmd === IKCP_CMD_WINS) {
      // do nothing and leave it to the flush
    } else {
      return -3
    }

    size -= len
    offset += len
  }

  if (flag !== 0) {
    parseFastack(kcp, maxack)
  }
}
