export function getCurrent() {
  return Date.now() & 0xffffffff
}
