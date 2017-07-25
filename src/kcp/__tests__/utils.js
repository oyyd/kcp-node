import { IKCP_OVERHEAD, create } from '../create'
import { readFromBuffer } from '../input'

export function createTestKCP() {
  return create(null, null)
}

export function decode(buf) {
  return Object.assign(readFromBuffer(buf, 0), {
    data: buf.slice(IKCP_OVERHEAD),
  })
}

export function decodeBufs(bufs) {
  const infos = []
  const { length } = bufs
  let offset = 0

  while (offset < length) {
    const info = decode(bufs.slice(offset, offset + IKCP_OVERHEAD))

    offset += IKCP_OVERHEAD

    infos.push(Object.assign({}, info, {
      data: bufs.slice(offset, offset + info.len),
    }))

    offset += info.len
  }

  return infos
}
