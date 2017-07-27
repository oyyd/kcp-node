import {
  setNodelay,
  setMtu,
  create,
  setOptions,
  IKCP_OVERHEAD,
  IKCP_MTU_DEF,
  DEFAULT_KCPCB,
} from '../create'

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

  describe('setNodelay', () => {
    it('should set `nodelay`, `interval`, `fastresend` and `nocwnd`', () => {
      const kcp = create(1, 1)

      expect(kcp.nodelay).toBe(0)
      expect(kcp.interval).toBe(100)
      expect(kcp.fastresend).toBe(0)
      expect(kcp.nocwnd).toBe(0)

      setNodelay(kcp, 1, 200, 1, 1)

      expect(kcp.nodelay).toBe(1)
      expect(kcp.interval).toBe(200)
      expect(kcp.fastresend).toBe(1)
      expect(kcp.nocwnd).toBe(1)
    })
  })

  describe('setOptions', () => {
    it('should set kcp properties', () => {
      const kcp = create(0, 0)

      setOptions(kcp, {
        nodelay: 1,
        interval: 200,
        fastresend: 3,
        nocwnd: 1,
        snd_wnd: 200,
        rcv_wnd: 200,
        mtu: 2000,
        stream: 1,
        rx_minrto: 5,
      })

      expect(kcp.nodelay).toBe(1)
      expect(kcp.interval).toBe(200)
      expect(kcp.fastresend).toBe(3)
      expect(kcp.nocwnd).toBe(1)
      expect(kcp.snd_wnd).toBe(200)
      expect(kcp.rcv_wnd).toBe(200)
      expect(kcp.mtu).toBe(2000)
      expect(kcp.stream).toBe(1)
      expect(kcp.rx_minrto).toBe(5)
    })
  })
})
