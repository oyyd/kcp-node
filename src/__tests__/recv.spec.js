import { moveRcvBuf, popRcvContent, getPeeksize } from '../recv'
import { createTestKCP } from './utils'

describe('recv.js', () => {
  let kcp

  beforeEach(() => {
    kcp = createTestKCP()
  })

  describe('getPeeksize', () => {
    it('should return the first seg `len` if the its `frg` is 0', () => {
      kcp.rcv_queue = [{
        len: 100,
        frg: 0,
      }, {
        len: 200,
        frg: 1,
      }]

      expect(getPeeksize(kcp)).toBe(100)
    })

    it('should plus all `rcv_queue` elements size utils it encounts one with the `frg` of 0', () => {
      kcp.rcv_queue = [{
        len: 300,
        frg: 2,
      }, {
        len: 300,
        frg: 1,
      }, {
        len: 400,
        frg: 0,
      }, {
        len: 100,
        frg: 0,
      }, {
        len: 500,
        frg: 1,
      }, {
        len: 777,
        frg: 0,
      }]

      kcp.nrcv_que = kcp.rcv_queue.length

      expect(getPeeksize(kcp)).toBe(1000)
    })
  })

  describe('popRcvContent', () => {
    it('should pop buffer from the `rcv_queue` ', () => {
      kcp.rcv_queue = [{
        len: 2,
        data: Buffer.from('FFFF', 'hex'),
        frg: 2,
      }, {
        len: 2,
        data: Buffer.from('EEEE', 'hex'),
        frg: 1,
      }, {
        len: 2,
        data: Buffer.from('DDDD', 'hex'),
        frg: 0,
      }, {
        len: 2,
        data: Buffer.from('CCCC', 'hex'),
        frg: 0,
      }]

      kcp.nrcv_que = kcp.rcv_queue.length
      const buffer = popRcvContent(kcp)

      expect(buffer.length).toBe(6)
      expect(buffer.toString('hex')).toBe('ffffeeeedddd')
      expect(kcp.rcv_queue.length).toBe(1)
    })
  })

  describe('moveRcvBuf', () => {
    it('should move those buf whose sn is smaller than ' +
      'the `rcv_nxt` while `nrcv_que` is smaller than the `rcv_wnd`', () => {
      kcp.rcv_buf = [{
        len: 2,
        data: Buffer.from('FFFF', 'hex'),
        frg: 2,
        sn: 0,
      }, {
        len: 2,
        data: Buffer.from('EEEE', 'hex'),
        frg: 1,
        sn: 1,
      }, {
        len: 2,
        data: Buffer.from('DDDD', 'hex'),
        frg: 0,
        sn: 2,
      }, {
        len: 2,
        data: Buffer.from('CCCC', 'hex'),
        frg: 0,
        sn: 3,
      }]

      kcp.rcv_nxt = 0
      kcp.nrcv_buf = kcp.rcv_buf.length
      kcp.rcv_queue = []
      kcp.nrcv_que = 0
      kcp.rcv_wnd = 3

      moveRcvBuf(kcp)

      expect(kcp.rcv_queue.map(seg => seg.sn)).toEqual([0, 1, 2])
      expect(kcp.rcv_buf.map(seg => seg.sn)).toEqual([3])
      expect(kcp.rcv_nxt).toBe(3)
    })

    it('should respect the rcv_nxt', () => {
      kcp.rcv_buf = [{
        len: 2,
        data: Buffer.from('FFFF', 'hex'),
        frg: 2,
        sn: 0,
      }, {
        len: 2,
        data: Buffer.from('EEEE', 'hex'),
        frg: 1,
        sn: 1,
      }, {
        len: 2,
        data: Buffer.from('DDDD', 'hex'),
        frg: 0,
        sn: 2,
      }, {
        len: 2,
        data: Buffer.from('CCCC', 'hex'),
        frg: 0,
        sn: 3,
      }]

      kcp.rcv_nxt = 1
      kcp.nrcv_buf = kcp.rcv_buf.length
      kcp.rcv_queue = []
      kcp.nrcv_que = 0
      kcp.rcv_wnd = 3

      moveRcvBuf(kcp)

      expect(kcp.rcv_queue.map(seg => seg.sn)).toEqual([])
      expect(kcp.rcv_buf.map(seg => seg.sn)).toEqual([0, 1, 2, 3])
      expect(kcp.rcv_nxt).toBe(1)
    })

    it('should respect the `rcv_wnd`', () => {
      kcp.rcv_buf = [{
        len: 2,
        data: Buffer.from('FFFF', 'hex'),
        frg: 2,
        sn: 0,
      }, {
        len: 2,
        data: Buffer.from('EEEE', 'hex'),
        frg: 1,
        sn: 1,
      }, {
        len: 2,
        data: Buffer.from('DDDD', 'hex'),
        frg: 0,
        sn: 2,
      }, {
        len: 2,
        data: Buffer.from('CCCC', 'hex'),
        frg: 0,
        sn: 3,
      }]

      kcp.rcv_nxt = 0
      kcp.nrcv_buf = kcp.rcv_buf.length
      kcp.rcv_queue = []
      kcp.nrcv_que = 0
      kcp.rcv_wnd = 2

      moveRcvBuf(kcp)

      expect(kcp.rcv_queue.map(seg => seg.sn)).toEqual([0, 1])
      expect(kcp.rcv_buf.map(seg => seg.sn)).toEqual([2, 3])
      expect(kcp.rcv_nxt).toBe(2)
    })
  })
})
