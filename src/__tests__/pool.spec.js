import crypto from 'crypto'
import dgram from 'dgram'
import { getId, createPool, decodeBuf } from '../pool'

describe('pool.js', () => {
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

  describe('createPool', () => {
    it('should create pool that you can `send` dgram with same sockets when the remoteAddr and remotePort are the same', (done) => {
      expect(pool.connCounts).toBe(0)

      let socket = pool.send(Buffer.from('0000ffff', 'hex'), addr.port, addr.address)

      expect(pool.connCounts).toBe(1)

      const sendPromise = new Promise((resolve) => {
        const handle = (d) => {
          expect(d.toString('hex')).toBe('0000ffff')
          socket.removeListener('message', handle)
          resolve()
        }

        socket.on('message', handle)
      })

      sendPromise.then(() => new Promise((resolve) => {
        socket = pool.send(Buffer.from('00000000', 'hex'), addr.port, addr.address)

        expect(pool.connCounts).toBe(1)

        const handle = (d) => {
          expect(d.toString('hex')).toBe('00000000')
          socket.removeListener('message', handle)
          resolve()
        }

        socket.on('message', handle)
      })).then(done)
    })

    it('should support to call `listen` on the localPort directly', (done) => {
      expect(pool.connCounts).toBe(0)

      let port

      const socket = pool.listen(0, (msg) => {
        expect(msg.data.toString('hex')).toBe('0000ffff')
        done()
      }, () => {
        port = socket.address().port

        dgram.createSocket('udp4').send(Buffer.from('0000ffff', 'hex'), port)
      })
      expect(pool.connCounts).toBe(1)
    })
  })

  describe('newConv', () => {
    it('should return a conv that is not occupied', () => {
      const remotePort = 123123
      const remoteAddr = '127.0.0.1'
      let conv = pool.newConv(remotePort, remoteAddr)

      expect(conv).toBe(0)

      conv = pool.newConv(remotePort, remoteAddr)

      expect(conv).toBe(1)

      conv = pool.newConv(remotePort, '192.168.0.1')

      const id = getId(remotePort, remoteAddr)

      pool.kcpConv[id][3] = true

      conv = pool.newConv(remotePort, remoteAddr)

      expect(conv).toBe(2)

      conv = pool.newConv(remotePort, remoteAddr)

      expect(conv).toBe(4)
    })
  })

  describe('deleteConv', () => {
    it('should delete a conv', () => {
      const remotePort = 123123
      const remoteAddr = '127.0.0.1'
      const id = getId(remotePort, remoteAddr)
      const conv = pool.newConv(remotePort, remoteAddr)

      expect(pool.kcpConv[id][0]).toBe(true)

      pool.deleteConv(remotePort, remoteAddr, conv)

      expect(pool.kcpConv[id][0]).toBeFalsy()
    })
  })

  describe('decodeBuf', () => {
    const algorithm = 'aes-128-cbc'
    const password = 'test'

    it('should simply pass data if no `algorithm` is specified', (done) => {
      const data = Buffer.from('ffffffff', 'hex')
      const rinfo = {}

      const next = jest.fn(() => {
        expect(next.mock.calls.length).toBe(1)
        expect(next.mock.calls[0][0]).toBe(data)
        expect(next.mock.calls[0][1]).toBe(rinfo)
        done()
      })

      decodeBuf({}, next, data, rinfo)
    })

    it('should encode the buffer is a `algorithm` is specified', (done) => {
      const oriData = Buffer.from('ffffffffffffffffffffffffffffffff', 'hex')
      const cipher = crypto.createCipher(algorithm, password)
      const data = Buffer.concat([cipher.update(oriData), cipher.final()])

      const rinfo = {}

      const next = jest.fn(() => {
        expect(next.mock.calls.length).toBe(1)
        expect(next.mock.calls[0][0].toString('hex')).toBe(oriData.toString('hex'))
        expect(next.mock.calls[0][1]).toBe(rinfo)
        done()
      })

      decodeBuf({
        algorithm,
        password,
      }, next, data, rinfo)
    })
  })
})
