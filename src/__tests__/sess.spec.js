const mockUpdate = jest.fn()
const mockCheck = jest.fn()

jest.mock('../kcp', () => ({
  getCurrent: () => Date.now(),
  update: mockUpdate,
  check: mockCheck,
}))

const { getCurrent } = require('../kcp')
const EventEmitter = require('events')
const { sessionBind, changeFlushStatus, output, update } = require('../sess')

describe('sess.js', () => {
  describe('changeFlushStatus', () => {
    it('should change the proerties of `tsFlush` and `changed`', () => {
      const sess = {
        tsFlush: 0,
        changed: false,
      }

      changeFlushStatus(sess, 1000, true)

      expect(sess.tsFlush).toBe(1000)
      expect(sess.changed).toBe(true)
    })
  })

  describe('output', () => {
    let udp

    beforeEach(() => {
      udp = {
        send: jest.fn(),
      }
    })

    it('should send the data through the udp connection of the session', () => {
      const sess = {
        udp,
        port: 1234,
        address: 'localhost',
      }

      const buff = Buffer.from('ffff0000', 'hex')

      output(sess, buff)

      expect(udp.send.mock.calls.length).toBe(1)
      expect(udp.send.mock.calls[0][0].toString('hex')).toBe('ffff0000')
      expect(udp.send.mock.calls[0][1]).toBe(sess.port)
      expect(udp.send.mock.calls[0][2]).toBe(sess.address)
    })
  })

  describe('update', () => {
    let sess
    let mockUpdateCalls
    let mockCheckCalls

    beforeEach(() => {
      mockUpdateCalls = mockUpdate.mock.calls.length
      mockCheckCalls = mockCheck.mock.calls.length

      sess = {
        tsFlush: 0,
        changed: false,
        kcp: {
          check: jest.fn(),
          update: jest.fn(),
        },
      }
    })

    it('should call `update` if `changed`', () => {
      sess.changed = true

      update(sess)

      expect(mockUpdate.mock.calls.length).toBe(mockUpdateCalls + 1)
      expect(sess.changed).toBe(false)
    })

    it('should not call `update` if the `tsFlush` is greater than `getCurrent()` ', () => {
      sess.tsFlush = getCurrent() + 10000

      update(sess)

      expect(mockUpdate.mock.calls.length).toBe(mockUpdateCalls)
      expect(sess.changed).toBe(false)
    })

    it('should call `check` if the `tsFlush` is 0', () => {
      sess.kcp.check = jest.fn()

      update(sess)

      expect(mockCheck.mock.calls.length).toBe(mockCheckCalls + 1)
      expect(mockUpdate.mock.calls.length).toBe(mockUpdateCalls)
      // expect(sess.tsFlush).toBe(current)
    })

    // it('should call `update` if the return value of `check` is' +
    //   ' less than `getCurrent()` even if the `tsFlush` is 0', () => {
    //   const current = getCurrent() - 10000
    //   sess.kcp.check = jest.fn(() => current)
    //
    //   update(sess)
    //
    //   expect(mockCheck.mock.calls.length).toBe(mockCheckCalls + 1)
    //   expect(mockUpdate.mock.calls.length).toBe(mockUpdateCalls + 1)
    //   expect(sess.tsFlush).toBe(0)
    // })
  })

  describe('sessionBind', () => {
    const port = 8888
    const address = 'localhost'

    let sess
    let kcp
    let udp

    beforeEach(() => {
      kcp = {

      }

      udp = new EventEmitter()
      udp.bind = jest.fn()

      sess = Object.assign(new EventEmitter(), {
        kcp,
        udp,
      })
    })

    it('should bind on the `port` of the `address`', () => {
      sessionBind(sess, port, address)

      expect(udp.bind.mock.calls.length).toBe(1)
      expect(udp.bind.mock.calls[0][0]).toBe(port)
      expect(udp.bind.mock.calls[0][1]).toBe(address)
    })

    it('should emit errors on `sess` when the `udp` throws', (done) => {
      sessionBind(sess, port, address)

      sess.on('error', (err) => {
        expect(err.message).toBe('invalid')
        done()
      })

      udp.emit('error', new Error('invalid'))
    })
  })
})
