import dgram from 'dgram'
import { IKCP_OVERHEAD } from '../kcp'
import { createPool } from '../pool'
import { KCPSocket } from '../socket'

describe('socket.js', () => {
  let echoUDP
  let addr
  let pool

  beforeEach((done) => {
    pool = createPool()

    echoUDP = dgram.createSocket('udp4')
    echoUDP.on('message', (buf, { address, port }) => {
      echoUDP.send(buf, port, address)
    })

    echoUDP.bind(() => {
      addr = echoUDP.address()
      done()
    })
  })

  afterEach((done) => {
    if (echoUDP) {
      echoUDP.close(done)
    }
  })

  describe('KCPSocket', () => {
    it('should write data to the remote server', (done) => {
      const s1 = new KCPSocket(null, {
        remotePort: addr.port,
        remoteAddr: addr.address,
        pool,
      })

      s1.write(Buffer.from('ffffffff', 'hex'))

      echoUDP.on('message', d => {
        expect(d.slice(IKCP_OVERHEAD).toString('hex')).toBe('ffffffff')
        done()
      })
    })
  })
})
