import {
  outputBuf,
  putQueueToBuf,
  outputProbe,
  setProbe,
  outputAcks,
  encodeSeg,
  updateAndFlush,
  check,
} from '../update'
import {
  IKCP_CMD_WASK,
  IKCP_ASK_SEND,
  IKCP_CMD_ACK,
  IKCP_PROBE_INIT,
  IKCP_OVERHEAD,
  IKCP_CMD_PUSH,
  createSegment,
} from '../create'
import { getCurrent } from '../utils'
import { createTestKCP } from './utils'

function createSeg(kcp) {
  const seg = createSegment()

  seg.conv = kcp.conv
  seg.cmd = IKCP_CMD_ACK
  seg.frg = 0
  seg.wnd = kcp.nrcv_que < kcp.rcv_wnd ? kcp.rcv_wnd - kcp.nrcv_que : 0
  seg.una = kcp.rcv_nxt
  seg.len = 0
  seg.sn = 0
  seg.ts = 0

  return seg
}

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
      kcp.snd_buf = [
        {
          resendts: current - 1000,
        },
      ]

      expect(check(kcp, current)).toBe(current)
    })

    it('should return a time which is the sum of current and diff', () => {
      kcp.interval = 1000
      kcp.updated = 1
      kcp.ts_flush = current + 1000
      kcp.snd_buf = [
        {
          resendts: current + 500,
        },
      ]

      expect(check(kcp, current)).toBe(current + 500)
    })

    it('should return a time which is not more than the sum of `current` and `interval`', () => {
      kcp.interval = 100
      kcp.updated = 1
      kcp.ts_flush = current + 1000
      kcp.snd_buf = [
        {
          resendts: current + 500,
        },
      ]

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

    it("should reset `ts_flush` if it's too small", () => {
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
      expect(buffer.slice(0, IKCP_OVERHEAD).toString('hex')).toBe(
        '000000015402000300000006000000050000000200000009',
      )
    })

    it('should', () => {
      buffer = Buffer.concat([
        Buffer.from('000000015402000300000006000000050000000200000009', 'hex'),
        Buffer.from('000000000000000000000000000000000000000000000000', 'hex'),
      ])

      encodeSeg(buffer, IKCP_OVERHEAD, seg)
      expect(buffer.slice(0, 2 * IKCP_OVERHEAD).toString('hex')).toBe(
        '000000015402000300000006000000050000000200000009000000015402000300000006000000050000000200000009',
      )
    })
  })

  describe('outputAcks', () => {
    let output
    let current
    let lasterBufferString
    let seg

    beforeEach(() => {
      seg = createSeg(kcp)

      current = 1448256732
      output = jest.fn(buffer => (lasterBufferString = buffer.toString('hex')))
      kcp.output = output
      kcp.mtu = IKCP_OVERHEAD * 3
      kcp.buffer = Buffer.alloc(kcp.mtu)
      kcp.acklist = [1, current + 10, 2, current + 20, 3, current + 30]
      kcp.ackcount = kcp.acklist.length / 2
    })

    it('should put all acks to the output buffer', () => {
      outputAcks(kcp, seg)

      expect(kcp.ackcount).toBe(0)
      expect(kcp.buffer.toString('hex')).toBe(
        '00000000520000205652a4e600000001000000000000000000000000520000205652a4f000000002000000000000000000000000520000205652a4fa000000030000000000000000',
      )
      expect(output.mock.calls.length).toBe(0)
    })

    it('should output all acks when their total sizes are larger than one mtu', () => {
      kcp.mtu = IKCP_OVERHEAD * 2
      outputAcks(kcp, seg)

      expect(kcp.ackcount).toBe(0)
      expect(kcp.buffer.toString('hex')).toBe(
        '00000000520000205652a4fa00000003000000000000000000000000520000205652a4f0000000020000000000000000000000000000000000000000000000000000000000000000',
      )
      expect(output.mock.calls.length).toBe(1)
      expect(lasterBufferString).toBe(
        '00000000520000205652a4e600000001000000000000000000000000520000205652a4f0000000020000000000000000',
      )
      expect(output.mock.calls[0][1]).toBe(kcp)
      expect(output.mock.calls[0][2]).toBe(kcp.user)
    })
  })

  describe('setProbe', () => {
    let current

    beforeEach(() => {
      current = getCurrent()
      kcp.current = current
    })

    it('should do nothing if we know the rmt_wnd', () => {
      kcp.rmt_wnd = 3

      setProbe(kcp)

      expect(kcp.ts_probe).toBe(0)
      expect(kcp.probe_wait).toBe(0)
    })

    it('should set initial wait properties if not set before', () => {
      kcp.rmt_wnd = 0
      setProbe(kcp)

      expect(kcp.probe_wait).toBe(IKCP_PROBE_INIT)
      expect(kcp.ts_probe).toBe(current + IKCP_PROBE_INIT)
    })

    it('should and another half time for waiting', () => {
      kcp.rmt_wnd = 0
      kcp.ts_probe = current - 100
      kcp.probe_wait = 8000

      setProbe(kcp)
      expect(kcp.probe_wait).toBe(8000 * 1.5)
      expect(kcp.ts_probe).toBe(current + 8000 * 1.5)
    })
  })

  describe('outputProbe', () => {
    let seg

    beforeEach(() => {
      seg = createSeg(kcp)
    })

    it('should do nothing if it dont probe', () => {
      kcp.probe = 0
      kcp.buffer = Buffer.alloc(IKCP_OVERHEAD * 2)

      outputProbe(kcp, seg, IKCP_OVERHEAD, IKCP_ASK_SEND, IKCP_CMD_WASK)

      expect(kcp.buffer.toString('hex')).toBe(
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      )
    })

    it('should put a segment to buffer if the kcp.probe support IKCP_ASK_SEND', () => {
      kcp.probe |= IKCP_ASK_SEND

      kcp.buffer = Buffer.alloc(IKCP_OVERHEAD * 2)

      outputProbe(kcp, seg, IKCP_OVERHEAD, IKCP_ASK_SEND, IKCP_CMD_WASK)

      expect(kcp.buffer.toString('hex')).toBe(
        '000000000000000000000000000000000000000000000000000000005300002000000000000000000000000000000000',
      )
    })

    it("should call output if if's over a mtu", () => {
      let lasterBufferString = ''
      kcp.mtu = IKCP_OVERHEAD * 2
      kcp.output = jest.fn(buf => (lasterBufferString = buf.toString('hex')))
      kcp.probe |= IKCP_ASK_SEND

      kcp.buffer = Buffer.alloc(IKCP_OVERHEAD * 2)

      outputProbe(kcp, seg, IKCP_OVERHEAD + 1, IKCP_ASK_SEND, IKCP_CMD_WASK)

      expect(lasterBufferString).toBe(
        '00000000000000000000000000000000000000000000000000',
      )
      expect(kcp.buffer.toString('hex')).toBe(
        '000000005300002000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      )
    })
  })

  describe('putQueueToBuf', () => {
    let seg

    beforeEach(() => {
      seg = createSegment()

      // seg.nrcv_que.length
      kcp.snd_queue = [
        Object.assign({}, seg, {
        }),
        Object.assign({}, seg, {
        }),
        Object.assign({}, seg, {
        }),
      ]
      kcp.nsnd_que = kcp.snd_queue.length
      kcp.snd_buf = []
      kcp.nsnd_buf = 0
      kcp.snd_una = 1
      kcp.snd_nxt = 1
    })

    it('should put segs from `snd_queue` to `snd_buf`', () => {
      const cwnd = 2
      putQueueToBuf(kcp, cwnd)

      expect(kcp.snd_queue.length).toBe(1)
      expect(kcp.snd_buf.length).toBe(2)
      expect(kcp.snd_buf.map(item => item.sn)).toEqual([1, 2])
      expect(kcp.snd_buf.every(item => item.cmd === IKCP_CMD_PUSH)).toBeTruthy()
      expect(kcp.nsnd_que).toBe(1)
      expect(kcp.nsnd_buf).toBe(2)
    })
  })

  describe('outputBuf', () => {
    let cwnd
    let next
    let rtomin
    let resent
    let offset
    let current

    beforeEach(() => {
      current = 1538287116
      offset = 0
      rtomin = 100
      resent = 100
      cwnd = 3

      next = jest.fn()

      kcp.rx_rto = 100
      kcp.current = current
      kcp.output = next
      kcp.snd_buf = [{
        xmit: 0,
        sn: 3,
        data: Buffer.from('11111111111111111111111111111111', 'hex'),
        len: 16,
      }]
      kcp.buffer = Buffer.alloc((IKCP_OVERHEAD + 1400) * 3)
    })

    it('should set initial `rto` and `resendts` if `xmit` is 0', () => {
      const { offset: off, lost, change } = outputBuf(kcp, cwnd, offset, rtomin, resent)

      const bufEle = kcp.snd_buf[0]
      expect(bufEle.xmit).toBe(1)
      expect(bufEle.rto).toBe(100)
      expect(bufEle.resendts).toBe(current + 100 + 100)
      expect(off).toBe(bufEle.len + IKCP_OVERHEAD)
      expect(lost).toBe(0)
      expect(change).toBe(0)
    })

    it('should set new `rto` and `resendts` if `current` is more than the resendts', () => {
      kcp.nodelay = 0
      kcp.snd_buf[0].xmit = 1
      kcp.snd_buf[0].rto = 100
      kcp.snd_buf[0].resendts = current - 10

      const { offset: off, lost, change } = outputBuf(kcp, cwnd, offset, rtomin, resent)

      const bufEle = kcp.snd_buf[0]
      expect(bufEle.xmit).toBe(2)
      expect(bufEle.rto).toBe(200)
      expect(bufEle.resendts).toBe(current + 200)
      expect(off).toBe(bufEle.len + IKCP_OVERHEAD)
      expect(lost).toBe(1)
      expect(change).toBe(0)
    })

    it('should plus half of a `rto` if `nodelay`', () => {
      kcp.nodelay = 1
      kcp.snd_buf[0].xmit = 1
      kcp.snd_buf[0].rto = 100
      kcp.snd_buf[0].resendts = current - 10

      const { offset: off, lost, change } = outputBuf(kcp, cwnd, offset, rtomin, resent)

      const bufEle = kcp.snd_buf[0]
      expect(bufEle.xmit).toBe(2)
      expect(bufEle.rto).toBe(150)
      expect(bufEle.resendts).toBe(current + 150)
      expect(bufEle.ts).toBe(current)
      expect(bufEle.wnd).toBe(cwnd)
      expect(off).toBe(bufEle.len + IKCP_OVERHEAD)
      expect(lost).toBe(1)
      expect(change).toBe(0)
      expect(kcp.buffer.slice(0, IKCP_OVERHEAD + bufEle.len).toString('hex'))
        .toBe('00000000000000035bb0660c00000003000000000000001011111111111111111111111111111111')
    })

    it('should not add rto if the `fastack` is smaller than the `resent`', () => {
      resent = current + 400
      kcp.nodelay = 1
      kcp.snd_buf[0].xmit = 1
      kcp.snd_buf[0].fastack = current + 500
      kcp.snd_buf[0].rto = 100
      kcp.snd_buf[0].resendts = current + 1000

      const { offset: off, lost, change } = outputBuf(kcp, cwnd, offset, rtomin, resent)

      const bufEle = kcp.snd_buf[0]
      expect(bufEle.xmit).toBe(2)
      expect(bufEle.rto).toBe(100)
      expect(bufEle.resendts).toBe(current + 100)
      expect(off).toBe(bufEle.len + IKCP_OVERHEAD)
      expect(lost).toBe(0)
      expect(change).toBe(1)
    })

    it('should do nothing if it don\'t satisfy the all the conditions above', () => {
      resent = current + 600
      kcp.nodelay = 1
      kcp.snd_buf[0].xmit = 1
      kcp.snd_buf[0].fastack = current + 500
      kcp.snd_buf[0].rto = 100
      kcp.snd_buf[0].resendts = current + 1000

      const { offset: off, lost, change } = outputBuf(kcp, cwnd, offset, rtomin, resent)

      const bufEle = kcp.snd_buf[0]
      expect(bufEle.xmit).toBe(1)
      expect(bufEle.rto).toBe(100)
      expect(bufEle.resendts).toBe(current + 1000)
      expect(off).toBe(0)
      expect(lost).toBe(0)
      expect(change).toBe(0)
      expect(kcp.buffer.slice(0, IKCP_OVERHEAD + bufEle.len).toString('hex'))
        .toBe('00000000000000000000000000000000000000000000000000000000000000000000000000000000')
    })
  })
})
