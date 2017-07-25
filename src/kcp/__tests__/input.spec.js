import { IKCP_OVERHEAD, IKCP_RTO_MAX, createSegment } from '../create'
import { createTestKCP } from './utils'
import {
  updateAck, parseAck, parseUna, shrinkBuf, updateCwnd,
  ackPush, parseData, parseFastack, readFromBuffer,
  ack, push,
} from '../input'

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
    kcpcb.nsnd_buf = kcpcb.snd_buf.length
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

  describe('parseAck', () => {
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
      expect(kcpcb.nsnd_buf).toBe(3)
      parseUna(kcpcb, 3)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([3])
      expect(kcpcb.nsnd_buf).toBe(1)
      parseUna(kcpcb, 4)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([])
      expect(kcpcb.nsnd_buf).toBe(0)
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
      expect(kcpcb.ackblock).toEqual(2)
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

  describe('parseFastack', () => {
    it('should add extral count to the `fastack` according to the `maxack` and the snd_buf', () => {
      kcpcb.snd_buf = [{
        sn: 4,
      }, {
        sn: 5,
      }, {
        sn: 6,
      }]
      kcpcb.snd_una = 3
      kcpcb.snd_nxt = 6
      kcpcb.fastack = 3

      const maxack = 5

      parseFastack(kcpcb, maxack)

      expect(kcpcb.fastack).toBe(4)
    })
  })

  describe('readFromBuffer', () => {
    it('should read segment content from the buffer', () => {
      const buffer = Buffer.from(
        // conv
        '00000001' +
        // cmd
        '54' +
        // frg
        '01' +
        // wnd
        '0002' +
        // ts
        '4558277d' +
        // sn
        '00000002' +
        // una
        '00000001' +
        // len
        '00000004' +
        // data
        '11111111' +
        // the second one
        // conv
        '00000002' +
        // cmd
        '54' +
        // frg
        '01' +
        // wnd
        '0002' +
        // ts
        '4558277d' +
        // sn
        '00000002' +
        // una
        '00000001' +
        // len
        '00000004' +
        // data
        '11111112',
        'hex',
      )

      let offset = 0
      let res
      let conv
      let cmd
      let frg
      let wnd
      let ts
      let sn
      let una
      let len
      let data

      res = readFromBuffer(buffer, offset)
      conv = res.conv
      cmd = res.cmd
      frg = res.frg
      wnd = res.wnd
      ts = res.ts
      sn = res.sn
      una = res.una
      len = res.len

      expect(conv).toBe(1)
      expect(cmd).toBe(84)
      expect(frg).toBe(1)
      expect(wnd).toBe(2)
      expect(ts).toBe(1163405181)
      expect(sn).toBe(2)
      expect(una).toBe(1)
      expect(len).toBe(4)

      data = buffer.slice(IKCP_OVERHEAD, IKCP_OVERHEAD + len)

      expect(data.toString('hex')).toBe('11111111')

      offset = IKCP_OVERHEAD + len

      res = readFromBuffer(buffer, offset)
      conv = res.conv
      cmd = res.cmd
      frg = res.frg
      wnd = res.wnd
      ts = res.ts
      sn = res.sn
      una = res.una
      len = res.len

      expect(conv).toBe(2)
      expect(cmd).toBe(84)
      expect(frg).toBe(1)
      expect(wnd).toBe(2)
      expect(ts).toBe(1163405181)
      expect(sn).toBe(2)
      expect(una).toBe(1)
      expect(len).toBe(4)

      data = buffer.slice(offset + IKCP_OVERHEAD, offset + IKCP_OVERHEAD + len)

      expect(data.toString('hex')).toBe('11111112')
    })
  })

  describe('ack', () => {
    it('should update `rx_rto` and remove the acknowledged `sn` and the correspond and set a new `snd_una`', () => {
      kcpcb.current = 1000
      kcpcb.snd_buf = [{
        sn: 1,
      }, {
        sn: 2,
      }, {
        sn: 3,
      }]
      kcpcb.snd_nxt = 4
      kcpcb.snd_una = 1
      const ts = 1100
      const sn = 1

      ack(kcpcb, ts, sn)

      expect(kcpcb.rx_rto).toBe(200)
      expect(kcpcb.snd_buf.map(item => item.sn)).toEqual([2, 3])
      expect(kcpcb.snd_una).toBe(2)
    })
  })

  describe('push', () => {
    const ts = 1000
    let seg = null

    beforeEach(() => {
      kcpcb.current = 1100
      kcpcb.rcv_wnd = 3
      kcpcb.rcv_nxt = 2
      kcpcb.rcv_queue = []
      kcpcb.rcv_buf = []
      kcpcb.acklist = []
      kcpcb.ackcount = 0
      kcpcb.ackblock = 0

      seg = createSegment()
    })

    it('should not push if the sn is out of the receive window', () => {
      const sn = 5
      push(kcpcb, ts, sn, seg)

      expect(kcpcb.rcv_queue.length).toBe(0)
      expect(kcpcb.rcv_buf.length).toBe(0)
    })

    it('should push the `sn` and `ts` of the segment to the `acklist` and push the segment into `rcv_buf` or `rcv_queue`', () => {
      const sn = 2
      seg.sn = 2
      push(kcpcb, ts, sn, seg)

      expect(kcpcb.acklist).toEqual([sn, ts])
      expect(kcpcb.ackcount).toEqual(1)
      expect(kcpcb.ackblock).toEqual(2)
      expect(kcpcb.rcv_queue[0]).toBe(seg)
    })
  })

  describe('updateCwnd', () => {
    it('should set the new `cwnd` and `incr`', () => {
      kcpcb.snd_una = 3
      kcpcb.ssthresh = 10000
      const originalUna = 2
      updateCwnd(kcpcb, originalUna)

      expect(kcpcb.cwnd).toBe(1)
      expect(kcpcb.incr).toBe(1400 - IKCP_OVERHEAD)
    })
  })
})
