import assert from 'assert'
import { createSegment } from './create'
import { isEmpty } from './utils'

// @private
export function appendToSeg(kcp, buffer, len) {
  const seg = kcp.snd_queue[kcp.snd_queue.length - 1]
  let offset

  if (seg.len < kcp.mss) {
    // 当前segment可以容纳的bytes
    const capacity = kcp.mss - seg.len
    const extend = len < capacity ? len : capacity

    if (buffer) {
      seg.data = Buffer.concat([seg.data, buffer.slice(0, extend)])
      offset = extend
    }

    seg.len += extend
    seg.frg = 0
    len -= extend
  }

  return {
    offset, len,
  }
}

export function send(kcp, buffer) {
  assert(kcp.mss > 0)

  let len = buffer.length
  let offset = 0
  // let seg

  if (len < 0) {
    return -1
  }

  if (kcp.stream !== 0) {
    if (!isEmpty(kcp.snd_queue)) {
      const res = appendToSeg(kcp, buffer, len)
      offset = res.offset
      len = res.len
    }

    if (len <= 0) {
      return 0
    }
  }

  let count = len <= kcp.mss ? 1 : Math.floor((len + kcp.mss - 1) / kcp.mss)

  if (count > 255) {
    return -2
  }

  if (count === 0) {
    count = 1
  }

  for (let i = 0; i < count; i += 1) {
    const size = len > kcp.mss ? kcp.mss : len

    const seg = createSegment()

    if (buffer && len > 0) {
      // NOTE: we only copy the buffer one time for a segment data to be
      // sent later here and never modify them inside a kcp cycle
      seg.data = Buffer.from(buffer.slice(offset, offset + size))
    }

    seg.len = size
    seg.frg = kcp.stream === 0 ? count - i - 1 : 0
    kcp.snd_queue.push(seg)
    kcp.nsnd_que += 1
    assert(kcp.snd_queue.length === kcp.nsnd_que)

    if (buffer) {
      offset += size
    }

    len -= size
  }

  return 0
}
