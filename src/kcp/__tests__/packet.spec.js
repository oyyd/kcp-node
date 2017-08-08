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
import { decode, decodeBufs } from './utils'

function getTimeBufString(time) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(time)

  return buf.toString('hex')
}

function getAllPackets(network, peer, current) {
  const packets = []
  let d = network.recv(1, current)

  while (Buffer.isBuffer(d)) {
    packets.push(d)
    d = network.recv(1, current)
  }

  return packets
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

  it.only('should send two packet from a kcp and receive them from the other kcp', () => {
    const current = getCurrent()
    // const size = data.length
    expect(send(kcp1, data)).toBe(0)

    // kcp.cwnv is zero
    update(kcp1, current)
    // kcp.cwnv is 1
    update(kcp1, current + 120)

    console.log('kcp1', kcp1)
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

    const packets = getAllPackets(network, 1, current)
    expect(packets.length).toBe(2)
    expect(packets.map(item => decode(item).sn)).toEqual([0, 1])
    expect(input(kcp2, Buffer.concat(packets))).toBe(0)

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
    const packets = getAllPackets(network, 1, current)

    expect(packets.length).toBe(2)
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
