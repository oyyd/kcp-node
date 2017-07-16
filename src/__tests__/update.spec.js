import { check } from '../update'
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
})
