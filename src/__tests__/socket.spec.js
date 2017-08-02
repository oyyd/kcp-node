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
        s1.close()
        done()
      })
    })

    it('should be closed and emit an "close" event when times out', (done) => {
      const s1 = new KCPSocket(null, {
        remotePort: addr.port,
        remoteAddr: addr.address,
        timeout: 50,
        pool,
      })

      s1.on('close', () => {
        done()
      })

      s1.write(Buffer.from('ffffffff', 'hex'))
    })
  })
})
