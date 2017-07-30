export function isEmpty(arr) {
  return !(Array.isArray(arr) && arr.length > 0)
}

// FYI: 100ns/op
export function getCurrent() {
  return (Date.now() & 0xffffffff) >>> 0
}
