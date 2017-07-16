import { getPeeksize } from '../recv'
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
})
