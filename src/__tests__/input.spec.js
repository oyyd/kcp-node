import { IKCP_RTO_MAX } from '../create'
import { createTestKCP } from './utils'
import { updateAck, parseAck, parseUna, shrinkBuf } from '../input'

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

    it('should', () => {
      kcpcb.snd_buf = []
      shrinkBuf(kcpcb)
      expect(kcpcb.snd_una).toBe(kcpcb.snd_nxt)
    })
  })
})
