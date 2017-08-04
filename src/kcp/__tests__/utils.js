import { IKCP_OVERHEAD, create } from '../create'
import { readFromBuffer } from '../input'

export function decode(buf, offset = 0) {
  return Object.assign(readFromBuffer(buf, offset), {
    data: buf.slice(offset + IKCP_OVERHEAD),
  })
}

export function createTestKCP() {
  return create(0, 0)
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
