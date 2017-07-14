import {
  IKCP_OVERHEAD,
  IKCP_CMD_PUSH,
  IKCP_CMD_ACK,
  IKCP_CMD_WASK,
  IKCP_CMD_WINS,
  IKCP_RTO_MAX,
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

// @private
export function input(kcp, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < IKCP_OVERHEAD) {
    return -1
  }

  let offset = 0
  let flag = 0
  let maxack = 0

  while (offset < buffer.length) {
    if (buffer.length - offset < IKCP_OVERHEAD) {
      break
    }

    const conv = buffer.readUInt32BE(0)

    if (conv !== kcp.conv) {
      return -1
    }

    const cmd = buffer.readUInt8BE(0, 4)
    const frg = buffer.readUInt8BE(0, 5)
    const wnd = buffer.readUInt16BE(0, 6)
    const ts = buffer.readUInt32BE(0, 8)
    const sn = buffer.readUInt32BE(0, 12)
    const una = buffer.readUInt32BE(0, 16)
    const len = buffer.readUInt32BE(0, 20)

    if (buffer.length - IKCP_OVERHEAD < len) {
      return -2
    }

    if (cmd !== IKCP_CMD_WINS && cmd !== IKCP_CMD_WASK
      && cmd !== IKCP_CMD_ACK && cmd !== IKCP_CMD_PUSH) {
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
    }
  }
}
