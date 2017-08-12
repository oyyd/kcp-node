// TODO: use stream buffer
// TODO: why one packet per loop?
import { NetworkSimulator } from './network_simulator'
import { IKCP_OVERHEAD, IKCP_DEADLINK } from '../create'
import {
  create,
  setWndSize,
  setOutput,
  setNodelay,
  input,
  recv,
  send,
  getCurrent,
  update,
} from '../index'
import { decodeBufs } from './utils'

function sendByPackets(kcp, data) {
  const times = Math.ceil(data.length / kcp.mss)

  for (let i = 0; i < times; i += 1) {
    send(kcp, data.slice(i * kcp.mss, (i + 1) * kcp.mss))
  }
}

function recvAll(kcp) {
  let data = Buffer.alloc(0)
  let b = recv(kcp, true)

  while (b !== -1 && b !== -2) {
    data = Buffer.concat([data, b])
    b = recv(kcp, true)
  }

  return data
}

function getTimeBufString(time) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(time)

  return buf.toString('hex')
}

describe('integration test', () => {
  let kcp1
  let kcp2
  let network
  let output
  let data

  beforeEach(() => {
    data = Buffer.alloc(2048, '11', 'hex')
    network = new NetworkSimulator(0, 40, 40)

    // eslint-disable-next-line
    output = jest.fn((buf, kcp, user) => {
      // eslint-disable-next-line
      // console.log('OUTPUT', decode(buf))
      return network.send(user, buf, true)
    })

    kcp1 = create(1, 0)
    kcp2 = create(1, 1)

    setOutput(kcp1, output)
    setOutput(kcp2, output)
    setWndSize(kcp1, 128, 128)
    setWndSize(kcp2, 128, 128)
  })

  it('should transmit large buffer', (done) => {
    const p0 = Date.now()
    const size = 4 * 1024 * 1024
    data = Buffer.alloc(size, '11', 'hex')
    network = new NetworkSimulator(0, 1, 1)

    // eslint-disable-next-line
    output = jest.fn((buf, kcp, user) => {
      // eslint-disable-next-line
      return network.send(user, buf, true)
    })

    kcp1 = create(1, 0)
    kcp2 = create(1, 1)

    setOutput(kcp1, output)
    setOutput(kcp2, output)
    setNodelay(kcp1, 1, 10, 0, 1)
    setNodelay(kcp2, 1, 10, 0, 1)
    setWndSize(kcp1, 4096, 4096)
    setWndSize(kcp2, 4096, 4096)

    let received = 0

    const loop = () => {
      const current = getCurrent()
      let d

      d = network.recv(1, current)

      if (typeof d !== 'number') {
        console.log(Date.now() - p0)
        console.log('kcp2_input', d.length, 'packets', decodeBufs(d).length)
        input(kcp2, d)
        console.log('end', Date.now() - p0)
      }

      d = recvAll(kcp2)

      if (typeof d !== 'number') {
        console.log(Date.now() - p0)
        console.log('kcp2_send', d.length)
        // console.log('kcp2', kcp2)
        sendByPackets(kcp2, d)
        console.log('end', Date.now() - p0)
      }

      update(kcp2, current)

      d = network.recv(0, current)

      if (typeof d !== 'number') {
        console.log(Date.now() - p0)
        console.log('kcp1_input', d.length, 'packets', decodeBufs(d).length)
        input(kcp1, d)
        console.log('end', Date.now() - p0)
      }

      d = recvAll(kcp1)

      if (typeof d !== 'number') {
        // console.log('get echo', d)
        received += d.length

        console.log(Date.now() - p0)
        console.log('received', d.length, received)

        if (received > 4000000) {
          console.log('size', size)
          console.log(kcp1.snd_buf.filter(i => i.xmit === 2).length, kcp2.snd_buf.filter(i => i.xmit === 2).length)
        }

        if (received === size) {
          done()
        }
      }

      update(kcp1, current)
    }

    setInterval(() => {
      process.nextTick(loop)
    }, 10)

    sendByPackets(kcp1, data)
  })

  it('should send two packet from a kcp and receive them from the other kcp', () => {
    const current = getCurrent()
    // const size = data.length
    expect(send(kcp1, data)).toBe(0)

    // kcp.cwnv is zero
    update(kcp1, current)
    // kcp.cwnv is 1
    update(kcp1, current + 120)

    expect(output.mock.calls.length).toBe(1)
    const buf = output.mock.calls[0][0]

    let bufString = '0000000151010080' + getTimeBufString(current + 120) + '000000000000000000000560'
      + '1111111111111111'

    expect(buf.slice(0, IKCP_OVERHEAD + 8).toString('hex')).toBe(bufString)

    let d = network.recv(1, current + 200)

    expect(d.slice(0, IKCP_OVERHEAD + 8).toString('hex')).toBe(bufString)

    input(kcp2, d)

    const recvData = recv(kcp2)

    // fragments are not completed
    expect(recvData).toBe(-2)

    update(kcp2, current + 200)

    d = network.recv(0, current + 300)

    bufString = '000000015200007f' + getTimeBufString(current + 120) + '000000000000000100000000'

    expect(d.slice(0, IKCP_OVERHEAD).toString('hex')).toBe(bufString)

    input(kcp1, d)

    update(kcp1, current + 300)

    d = network.recv(1, current + 400)

    expect(Buffer.isBuffer(d)).toBeTruthy()

    input(kcp2, d)

    update(kcp2, current + 400)

    d = network.recv(0, current + 500)

    expect(Buffer.isBuffer(d)).toBeTruthy()

    input(kcp1, d)

    expect(kcp1.snd_queue.length).toBe(0)
    expect(kcp1.snd_buf.length).toBe(0)
    expect(kcp1.nsnd_que).toBe(0)
    expect(kcp1.nsnd_buf).toBe(0)
  })

  it('should retransmit packets when a kcpcb doesn\'t receive a ack for a long time', () => {
    data = Buffer.allocUnsafe(2048)
    let current = getCurrent()

    setNodelay(kcp1, 1, 0, 0, 1)
    setNodelay(kcp2, 1, 0, 0, 1)

    expect(send(kcp1, data)).toBe(0)

    update(kcp1, current)

    let d = network.recv(1, current + 40)

    expect(Buffer.isBuffer(d)).toBeTruthy()

    // assume data missing
    network.clear(1)

    current = kcp1.snd_buf[0].resendts - 10
    update(kcp1, current)

    d = network.recv(1, current)

    expect(d).toBe(-1)

    current = kcp1.snd_buf[0].resendts
    update(kcp1, current)

    const buffer = network.recv(1, current)
    expect(input(kcp2, buffer)).toBe(0)

    d = recv(kcp2)

    expect(d.length).toBe(2048)
    expect(data.toString('hex')).toEqual(d.toString('hex'))

    current += 40
    update(kcp2, current)

    d = network.recv(0, current)

    expect(decodeBufs(d).map(item => item.sn)).toEqual([0, 1])

    input(kcp1, d)

    expect(kcp1.nsnd_buf).toBe(0)
    expect(kcp1.nsnd_que).toBe(0)
    expect(kcp1.nrcv_que).toBe(0)
    expect(kcp1.nrcv_buf).toBe(0)
    expect(kcp2.nsnd_buf).toBe(0)
    expect(kcp2.nsnd_que).toBe(0)
    expect(kcp2.nrcv_que).toBe(0)
    expect(kcp2.nrcv_buf).toBe(0)
  })

  it('should change `kcp.state` to -1 when a segment lost too may times', () => {
    let current = getCurrent()

    setNodelay(kcp1, 1, 0, 0, 1)
    setNodelay(kcp2, 1, 0, 0, 1)

    expect(send(kcp1, data)).toBe(0)
    update(kcp1, current)

    current += 40

    expect(kcp1.snd_buf[0].xmit).toBe(1)
    expect(kcp1.snd_buf[1].xmit).toBe(1)
    expect(kcp1.state).toBe(0)

    for (let i = 0; i < IKCP_DEADLINK - 2; i += 1) {
      current = kcp1.snd_buf[0].resendts
      update(kcp1, current)
      expect(kcp1.snd_buf[0].xmit).toBe(i + 2)
      expect(kcp1.snd_buf[1].xmit).toBe(i + 2)
      expect(kcp1.state).toBe(0)
    }

    current = kcp1.snd_buf[0].resendts
    update(kcp1, current)
    expect(kcp1.snd_buf[0].xmit).toBe(IKCP_DEADLINK)
    expect(kcp1.snd_buf[1].xmit).toBe(IKCP_DEADLINK)
    expect(kcp1.state).toBe(-1)
  })
})
