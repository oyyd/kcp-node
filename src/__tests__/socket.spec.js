import dgram from 'dgram'
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
    it('should', () => {
      const socket = new KCPSocket(null, {
        remotePort: 12313,
        remoteAddr: '127.0.0.1',
        pool,
      })

      console.log('socket', socket)
    })
  })
})
