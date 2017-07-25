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
