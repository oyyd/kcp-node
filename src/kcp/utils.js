export function isEmpty(arr) {
  return !(Array.isArray(arr) && arr.length > 0)
}

export function uint32ToNumber(uint32) {
  const b = Buffer.alloc(4)

  b.writeInt32BE(uint32)

  return b.readUInt32BE()
}

export function getCurrent() {
  return uint32ToNumber(Date.now() & 0xffffffff)
}
