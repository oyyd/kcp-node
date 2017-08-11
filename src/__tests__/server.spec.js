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

      let length = 0
      let received = Buffer.alloc(0)

      server.on('connection', socket => {
        socket.on('data', (d) => {
          length += d.length
          received = Buffer.concat([received, d])

          if (length === data.length) {
            expect(received.toString('hex')).toBe(data.toString('hex'))
            socket.close()
            server.close()
            done()
          }
        })
      })

      const socket = new KCPSocket(null, {
        remoteAddr: addr,
        remotePort: serverPort,
        pool,
      })

      socket.write(data)
    })

    it('should send a large data to the server', (done) => {
      const addr = '127.0.0.1'
      const serverPort = 12310
      const data = Buffer.alloc(1024 * 10, 'ff', 'hex')

      const server = new Server({
        pool,
        localPort: serverPort,
      })

      let received = Buffer.allocUnsafe(0)

      server.on('connection', socket => {
        socket.on('data', (d) => {
          received = Buffer.concat([received, d])

          if (received.toString('hex') === data.toString('hex')) {
            socket.close()
            server.close()
            done()
          }
        })
      })

      const socket = new KCPSocket(null, {
        remoteAddr: addr,
        remotePort: serverPort,
        pool,
      })

      socket.write(data)
    })

    it('should write data to the server and receive an echo', (done) => {
      const addr = '127.0.0.1'
      const serverPort = 12310
      const data = Buffer.alloc(1024 * 10, 'ff', 'hex')

      const server = new Server({
        pool,
        localPort: serverPort,
      })

      server.on('connection', conn => {
        conn.on('data', (d) => {
          conn.write(d)
        })
      })

      const socket = new KCPSocket(null, {
        remoteAddr: addr,
        remotePort: serverPort,
        pool,
      })

      let echoed = Buffer.alloc(0)

      socket.on('data', (d) => {
        echoed = Buffer.concat([echoed, d])

        if (echoed.toString('hex') === data.toString('hex')) {
          done()
        }
      })

      socket.write(data)
    })
  })
})
