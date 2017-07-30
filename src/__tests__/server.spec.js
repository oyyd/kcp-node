import { KCPSocket } from '../socket'
import { Server } from '../server'
import { createPool } from '../pool'

describe('server.js', () => {
  let pool
  beforeEach(() => {
    pool = createPool()
  })

  afterEach(() => {
    pool.clear()
  })

  describe('Server', () => {
    it('should create a server that could receive msg from kcp sockets', (done) => {
      const addr = '127.0.0.1'
      const serverPort = 12310
      const data = Buffer.alloc(2048, 'ff', 'hex')

      const server = new Server({
        pool,
        localPort: serverPort,
      })

      server.on('connection', socket => {
        socket.on('data', (d) => {
          expect(d.toString('hex')).toBe(data.toString('hex'))
          done()
        })
      })

      const socket = new KCPSocket(null, {
        remoteAddr: addr,
        remotePort: serverPort,
        pool,
      })

      socket.write(data)
    })
  })
})
