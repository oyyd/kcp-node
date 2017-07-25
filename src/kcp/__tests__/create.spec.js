import { setMtu, create, IKCP_OVERHEAD, IKCP_MTU_DEF, DEFAULT_KCPCB } from '../create'

describe('create.js', () => {
  describe('create', () => {
    it('should create an kcp instance with some specified keys', () => {
      const kcp = create(null, null)

      expect(Object.keys(kcp)).toEqual(Object.keys(DEFAULT_KCPCB))
      expect(kcp.mtu).toBe(IKCP_MTU_DEF)
      expect(kcp.mss).toBe(IKCP_MTU_DEF - IKCP_OVERHEAD)
    })
  })

  describe('setMtu', () => {
    it('should set mtu and mss at the same time', () => {
      const kcp = create(null, null)

      setMtu(kcp, 1000)

      expect(kcp.mtu).toBe(1000)
      expect(kcp.mss).toBe(976)
    })
  })
})
