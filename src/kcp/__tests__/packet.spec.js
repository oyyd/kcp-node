import { NetworkSimulator } from './network_simulator'
import { IKCP_OVERHEAD } from '../create'
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
import { decode } from './utils'

function getTimeBufString(time) {
  const buf = Buffer.alloc(4)
  buf.writeInt32BE(time)

  return buf.toString('hex')
}

describe('integration test', () => {
  let kcp1
  let kcp2
  let network
  let output

  beforeEach(() => {
    network = new NetworkSimulator(0)

    output = jest.fn((buf, kcp, user) => {
      // eslint-disable-next-line
      // console.log(user, decode(buf))
      return network.send(user, buf)
    })

    kcp1 = create(1, 0)
    kcp2 = create(1, 1)

    setOutput(kcp1, output)
    setOutput(kcp2, output)
    setWndSize(kcp1, 128, 128)
    setWndSize(kcp2, 128, 128)
  })

  it('should send two packet from a kcp and receive them from the other kcp', () => {
    const data = Buffer.alloc(2048, '11', 'hex')
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

    expect(d).toBeTruthy()

    input(kcp2, d)

    update(kcp2, current + 400)

    d = network.recv(0, current + 500)

    expect(d).toBeTruthy()

    input(kcp1, d)

    // console.log('kcp1', kcp1, kcp2)

    expect(kcp1.snd_queue.length).toBe(0)
    expect(kcp1.snd_buf.length).toBe(0)
    expect(kcp1.nsnd_que).toBe(0)
    expect(kcp1.nsnd_buf).toBe(0)
  })

  describe('', () => {

  })
})
