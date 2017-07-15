import { IKCP_RTO_MAX, createSegment } from '../create'
import { createTestKCP } from './utils'
import { updateAck, parseAck, parseUna, shrinkBuf, ackPush, parseData } from '../input'

describe('input.js', () => {
  let kcpcb = null

  beforeEach(() => {
    kcpcb = createTestKCP()
    kcpcb.snd_buf = [{
      sn: 1,
    }, {
      sn: 2,
    }, {
      sn: 3,
    }]
    kcpcb.snd_una = 1
    kcpcb.snd_nxt = 3
  })

  describe('updateAck', () => {
    it('should set the initial value depending on the rtt', () => {
      const rtt = 100
      updateAck(kcpcb, rtt)

      expect(kcpcb.rx_rto).toBe(300)
    })

    it('should setting the rto while keeping it bigger than the interval', () => {
      const rtt = 10

      updateAck(kcpcb, rtt)

      expect(kcpcb.rx_rto).toBe(110)
    })

    it('should setting the rto while keeping it smaller than the `IKCP_RTO_MAX`', () => {
      const rtt = IKCP_RTO_MAX * 2

      updateAck(kcpcb, rtt)

      expect(kcpcb.rx_rto).toBe(IKCP_RTO_MAX)
    })
  })

  describe('ikcp_parse_ack', () => {
    it('should directly return when the `sn` is out of the un-acknowledge sn', () => {
      const sendBufLength = kcpcb.snd_buf.length

      parseAck(kcpcb, 0)

      expect(kcpcb.snd_buf.length).toBe(sendBufLength)

      parseAck(kcpcb, 3)

      expect(kcpcb.snd_buf.length).toBe(sendBufLength)
    })

    it('should delete the buffer that has the same sn', () => {
      parseAck(kcpcb, 2)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([1, 3])
      parseAck(kcpcb, 1)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([3])
    })
  })

  describe('parseUna', () => {
    it('should drop acknowledged snd_buf', () => {
      parseUna(kcpcb, 1)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([1, 2, 3])
      parseUna(kcpcb, 3)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([3])
      parseUna(kcpcb, 4)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([])
    })
  })

  describe('shrinkBuf', () => {
    it('should set `snd_una` to the `sn` of the next snd_buf element', () => {
      shrinkBuf(kcpcb)
      expect(kcpcb.snd_una).toBe(1)
    })

    it('should take `snd_nxt` as the `snd_una` when the `snd_buf` is empty', () => {
      kcpcb.snd_buf = []
      shrinkBuf(kcpcb)
      expect(kcpcb.snd_una).toBe(kcpcb.snd_nxt)
    })
  })

  describe('ackPush', () => {
    beforeEach(() => {
      kcpcb.acklist = []
      kcpcb.ackblock = 0
    })

    // TODO:
    it('should set `sn` and `ts` to the tree of `acklist`', () => {
      const sn = 10
      const ts = Date.now()
      ackPush(kcpcb, sn, ts)

      expect(kcpcb.acklist).toEqual([sn, ts])
      expect(kcpcb.ackblock).toEqual(1)
      expect(kcpcb.ackcount).toEqual(1)
    })
  })

  describe('parseData', () => {
    it('should push the new segment to the `rcv_queue`', () => {
      kcpcb.rcv_buf = [{
        sn: 4,
      }, {
        sn: 5,
      }, {
        sn: 6,
      }]

      kcpcb.rcv_nxt = 3
      kcpcb.rcv_wnd = 5

      kcpcb.rcv_queue = [{
        sn: 1,
      }, {
        sn: 2,
      }]
      kcpcb.nrcv_que = 2

      const seg = createSegment()
      seg.sn = 3

      parseData(kcpcb, seg)

      expect(kcpcb.rcv_nxt).toBe(6)
      expect(kcpcb.rcv_buf.map(item => item.sn)).toEqual([6])
      expect(kcpcb.rcv_queue.map(item => item.sn)).toEqual([1, 2, 3, 4, 5])
    })

    it('should not push segments to the `rcv_queue` if the `sn` is not equal to the `rcv_nxt` ', () => {
      kcpcb.rcv_buf = [{
        sn: 5,
      }, {
        sn: 6,
      }]

      kcpcb.rcv_nxt = 3
      kcpcb.rcv_wnd = 5

      kcpcb.rcv_queue = [{
        sn: 1,
      }, {
        sn: 2,
      }]
      kcpcb.nrcv_que = 2

      const seg = createSegment()
      seg.sn = 4

      parseData(kcpcb, seg)

      expect(kcpcb.rcv_nxt).toBe(3)
      expect(kcpcb.rcv_buf.map(item => item.sn)).toEqual([4, 5, 6])
      expect(kcpcb.rcv_queue.map(item => item.sn)).toEqual([1, 2])
    })
  })
})
