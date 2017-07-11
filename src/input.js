import {
  IKCP_OVERHEAD,
  IKCP_CMD_PUSH,
  IKCP_CMD_ACK,
  IKCP_CMD_WASK,
  IKCP_CMD_WINS,
} from './create'

function ack() {

}

function input(kcp, buffer) {
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
