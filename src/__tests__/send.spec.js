import { appendToSeg, send } from '../send'
import { setMtu } from '../create'
import { createTestKCP } from './utils'

describe('send.js', () => {
  let kcp

  beforeEach(() => {
    kcp = createTestKCP()
  })

  describe('appendToSeg', () => {
    beforeEach(() => {
      const len = 700
      kcp.snd_queue = [{
        len,
        data: Buffer.alloc(len),
      }]
    })

    it('should append a part buffer into the segments from `snd_queue` if possible', () => {
      const len = 1400
      const buffer = Buffer.alloc(len)
      const { offset, len: nextLen } = appendToSeg(kcp, buffer, len)

      expect(offset).toBe(676)
      expect(nextLen).toBe(724)
      expect(kcp.snd_queue[0].data.length).toBe(1376)
      expect(kcp.snd_queue[0].len).toBe(1376)
    })
  })

  describe('send', () => {
    let buffer

    beforeEach(() => {
      setMtu(kcp, 1400)
      kcp.snd_queue = []
      kcp.stream = 0
      buffer = Buffer.alloc(4000)
    })

    it('should create segments from buffer and append them into the `snd_queue`', () => {
      send(kcp, buffer)

      expect(kcp.snd_queue.length).toBe(3)
      expect(kcp.snd_queue.map(item => item.len).reduce((o, a) => o + a, 0)).toBe(4000)
      expect(kcp.nsnd_que).toBe(3)
    })
  })
})
