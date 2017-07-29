import { IKCP_ASK_TELL } from './create'
import { isEmpty } from './utils'

// @private
export function getPeeksize(kcp) {
  const queueLength = kcp.rcv_queue.length
  let length = 0

  if (isEmpty(kcp.rcv_queue)) {
    return -1
  }

  let seg = kcp.rcv_queue[0]

  if (seg.frg === 0) {
    return seg.len
  }

  // NOTE: not all of the fragments are received in stream mode
  if (kcp.nrcv_que < seg.frg + 1) {
    return -1
  }

  let i = 0

  // NOTE: `frg` has an opposite order comparing to `sn`
  for (; i < queueLength; i += 1) {
    seg = kcp.rcv_queue[i]

    length += seg.len

    if (seg.frg === 0) {
      break
    }
  }

  return length
}

// @private
export function popRcvContent(kcp) {
  let i = 0

  for (; i < kcp.nrcv_que; i += 1) {
    if (kcp.rcv_queue[i].frg === 0) {
      break
    }
  }

  const segSlice = kcp.rcv_queue.splice(0, i + 1)
  kcp.nrcv_que -= i + 1

  return Buffer.concat(segSlice.map(seg => seg.data))
}

// @private
export function moveRcvBuf(kcp) {
  let i
  const rcvBufLength = kcp.nrcv_buf

  for (i = 0; i < rcvBufLength; i += 1) {
    const seg = kcp.rcv_buf[i]

    if (!(kcp.rcv_nxt + i === seg.sn && kcp.nrcv_que + i < kcp.rcv_wnd)) {
      break
    }
  }

  const rcvBufSlice = kcp.rcv_buf.splice(0, i)
  kcp.nrcv_buf -= i
  kcp.rcv_queue.push(...rcvBufSlice)
  kcp.nrcv_que += i
  kcp.rcv_nxt += i
}

// NOTE: the `buffer` is not a pointer
// so we return a buffer directly
export function recv(kcp) {
  let peeksize = 0
  let recover = 0

  if (isEmpty(kcp.rcv_queue)) {
    return -1
  }

  peeksize = getPeeksize(kcp)

  if (peeksize < 0) {
    return -2
  }

  if (kcp.nrcv_que >= kcp.rcv_wnd) {
    recover = 1
  }

  const buffer = popRcvContent(kcp)

  moveRcvBuf(kcp)

  // fast recover
  if (kcp.nrcv_que < kcp.rcv_wnd && recover) {
    // ready to send back IKCP_CMD_WINS in ikcp_flush
    // tell remote my window size
    kcp.probe |= IKCP_ASK_TELL
  }

  // NOTE: break the c convertion
  return buffer
}
