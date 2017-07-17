import { encodeSeg, updateAndFlush, check } from '../update'
import { IKCP_OVERHEAD, createSegment } from '../create'
import { getCurrent } from '../utils'
import { createTestKCP } from './utils'

describe('update.js', () => {
  let kcp

  beforeEach(() => {
    kcp = createTestKCP()
  })

  describe('check', () => {
    let current
    beforeEach(() => {
      current = getCurrent()
    })

    it('should return current when not updated', () => {
      kcp.updated = 0

      const time = check(kcp, current)

      expect(time).toBe(current)
    })

    it('should return current when the ts_flush is smaller the current', () => {
      kcp.updated = 1
      kcp.ts_flush = current - 1000

      const time = check(kcp, current)
      expect(time).toBe(current)
    })

    it('should return `current` the if one of the `resendts` in `snd_buf` is smaller/equal to the current', () => {
      kcp.updated = 1
      kcp.ts_flush = current + 1000
      kcp.snd_buf = [{
        resendts: current - 1000,
      }]

      expect(check(kcp, current)).toBe(current)
    })

    it('should return a time which is the sum of current and diff', () => {
      kcp.interval = 1000
      kcp.updated = 1
      kcp.ts_flush = current + 1000
      kcp.snd_buf = [{
        resendts: current + 500,
      }]

      expect(check(kcp, current)).toBe(current + 500)
    })

    it('should return a time which is not more than the sum of `current` and `interval`', () => {
      kcp.interval = 100
      kcp.updated = 1
      kcp.ts_flush = current + 1000
      kcp.snd_buf = [{
        resendts: current + 500,
      }]

      expect(check(kcp, current)).toBe(current + 100)
    })
  })

  describe('updateAndFlush', () => {
    let next
    let current

    beforeEach(() => {
      next = jest.fn()
      current = getCurrent()
      kcp.interval = 1000
    })

    it('should set `current`, `ts_flush` and call the next func', () => {
      kcp.ts_flush = current - 500
      kcp.updated = 1

      updateAndFlush(kcp, current, next)

      expect(kcp.current).toBe(current)
      expect(kcp.ts_flush).toBe(current - 500 + 1000)
      expect(next.mock.calls.length).toBe(1)
      expect(next.mock.calls[0][0]).toBe(kcp)
    })

    it('should set `updated` if not updated', () => {
      kcp.updated = 0

      updateAndFlush(kcp, current, next)
      expect(kcp.updated).toBe(1)
      expect(kcp.ts_flush).toBe(current + 1000)
      expect(kcp.current).toBe(current)
    })

    it('should reset `ts_flush` if it\'s too small', () => {
      kcp.updated = 1
      kcp.ts_flush = current - 20000

      updateAndFlush(kcp, current, next)
      expect(kcp.ts_flush).toBe(current + 1000)
      expect(kcp.current).toBe(current)
    })
  })

  describe('encodeSeg', () => {
    let buffer
    let seg

    beforeEach(() => {
      buffer = Buffer.alloc(IKCP_OVERHEAD * 3)
      seg = createSegment()
      seg.conv = 1
      seg.cmd = 84
      seg.frg = 2
      seg.wnd = 3
      seg.una = 2
      seg.len = 9
      seg.sn = 5
      seg.ts = 6
    })

    it('should append segment info to the buffer', () => {
      encodeSeg(buffer, 0, seg)
      expect(buffer.slice(0, IKCP_OVERHEAD).toString('hex'))
        .toBe('000000015402000300000006000000050000000200000009')
    })

    it('should', () => {
      buffer = Buffer.concat([
        Buffer.from('000000015402000300000006000000050000000200000009', 'hex'),
        Buffer.from('000000000000000000000000000000000000000000000000', 'hex'),
      ])

      encodeSeg(buffer, IKCP_OVERHEAD, seg)
      expect(buffer.slice(0, 2 * IKCP_OVERHEAD).toString('hex'))
        .toBe('000000015402000300000006000000050000000200000009000000015402000300000006000000050000000200000009')
    })
  })
})
