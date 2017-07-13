import {
  IKCP_OVERHEAD,
  IKCP_CMD_PUSH,
  IKCP_CMD_ACK,
  IKCP_CMD_WASK,
  IKCP_CMD_WINS,
  IKCP_RTO_MAX,
} from './create'

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

  rto = kcp.rx_srtt + Math.max(kcp.interval, kcp.rx_rttval * 4)
  kcp.rx_rto = Math.max(Math.min(kcp.rx_minrto, rto), IKCP_RTO_MAX)
}

function ack(kcp, ts) {
  const delta = kcp.current - ts

  if (delta >= 0) {
    updateAck(kcp, delta)
  }
}

/**
 * @private
 * @param  {[type]} kcp    [description]
 * @param  {[type]} buffer [description]
 * @return {[type]}        [description]
 */
export function input(kcp, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < IKCP_OVERHEAD) {
    return -1
  }

  let offset = 0

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

    if (cmd !== IKCP_CMD_WINS && cmd !== IKCP_CMD_WASK
      && cmd !== IKCP_CMD_ACK && cmd !== IKCP_CMD_PUSH) {
      return -3
    }

    if (cmd === IKCP_CMD_ACK) {
      ack(kcp)
    }
  }
}
